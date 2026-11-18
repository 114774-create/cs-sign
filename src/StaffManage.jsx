import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { fetchAll } from './api';
import { fetchSettings, AUTH_KEYS } from './settings';
import { exportGuestsCSV, exportGuestsXLSX } from './fileUtils';
import InvitationPanel from './InvitationPanel';
import SettingsPanel from './SettingsPanel';

const emptyForm = { name: '', unit: '', title: '' };
const TABS = [
  { id: 'guests', label: '簽到名單' },
  { id: 'invitations', label: '邀請名單' },
  { id: 'settings', label: '活動設定' },
];

export default function StaffManage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('guests');
  const [guests, setGuests] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [eventName, setEventName] = useState('校慶');
  const [formData, setFormData] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const busyRef = useRef(false);
  const toastTimer = useRef(null);

  const notify = useCallback((message, type = 'ok') => {
    setToast({ message, type });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const loadGuests = useCallback(async () => {
    try {
      setGuests(await fetchAll('cssign_guests', '*', ['seq_num', 'id']));
    } catch (err) {
      console.error(err);
    }
  }, []);

  const loadInvitations = useCallback(async () => {
    try {
      const inv = await fetchAll('cssign_invitations', '*', ['name', 'id']);
      setInvitations([...inv].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant')));
    } catch (err) {
      console.error(err);
    }
  }, []);

  const reloadAll = useCallback(async () => {
    await Promise.all([loadGuests(), loadInvitations()]);
  }, [loadGuests, loadInvitations]);

  useEffect(() => {
    reloadAll();
    fetchSettings().then((s) => setEventName(s.eventName));
    // 每 5 秒同步簽到名單，讓前台平板新增的來賓即時出現；邀請名單每 30 秒同步
    const gi = setInterval(() => { if (!busyRef.current) loadGuests(); }, 5000);
    const ii = setInterval(loadInvitations, 30000);
    return () => { clearInterval(gi); clearInterval(ii); clearTimeout(toastTimer.current); };
  }, [reloadAll, loadGuests, loadInvitations]);

  const withBusy = async (fn) => {
    busyRef.current = true;
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      console.error(err);
      notify(`操作失敗：${err.message}`, 'error');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  // 姓名與邀請名單唯一相符時自動帶入
  const handleNameChange = (e) => {
    const name = e.target.value;
    const exact = invitations.filter((i) => i.name === name.trim());
    if (!editId && name.trim().length >= 2 && exact.length === 1) {
      setFormData({ name: exact[0].name, unit: exact[0].unit || '', title: exact[0].title || '' });
    } else {
      setFormData((prev) => ({ ...prev, name }));
    }
  };

  // 重新編排為 1 開始的連續序號並回存（只更新有變動的列）
  const reorderAndSave = async (updatedList) => {
    const reordered = updatedList.map((g, index) => ({ ...g, seq_num: index + 1 }));
    const changed = reordered.filter((g) => {
      const old = guests.find((o) => o.id === g.id);
      return !old || old.seq_num !== g.seq_num;
    });
    setGuests(reordered);
    const results = await Promise.all(
      changed.map((g) => supabase.from('cssign_guests').update({ seq_num: g.seq_num }).eq('id', g.id))
    );
    const failed = results.find((r) => r.error);
    if (failed) throw failed.error;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    withBusy(async () => {
      const row = { name: formData.name.trim(), unit: formData.unit.trim(), title: formData.title.trim() };
      if (editId) {
        const { error } = await supabase.from('cssign_guests').update(row).eq('id', editId);
        if (error) throw error;
        setEditId(null);
      } else {
        const { data: last, error: seqErr } = await supabase
          .from('cssign_guests').select('seq_num').order('seq_num', { ascending: false }).limit(1).maybeSingle();
        if (seqErr) throw seqErr;
        const { error } = await supabase.from('cssign_guests').insert([{ ...row, seq_num: last ? last.seq_num + 1 : 1 }]);
        if (error) throw error;
      }
      setFormData(emptyForm);
      await loadGuests();
    });
  };

  const cancelEdit = () => { setEditId(null); setFormData(emptyForm); };

  const handleDelete = (id, name) => {
    if (!window.confirm(`確定要刪除來賓 ${name} 嗎？`)) return;
    withBusy(async () => {
      const { error } = await supabase.from('cssign_guests').delete().eq('id', id);
      if (error) throw error;
      await reorderAndSave(guests.filter((g) => g.id !== id));
      if (editId === id) cancelEdit();
    });
  };

  const moveGuest = (index, direction) => {
    if ((direction === -1 && index === 0) || (direction === 1 && index === guests.length - 1)) return;
    withBusy(async () => {
      const newList = [...guests];
      [newList[index], newList[index + direction]] = [newList[index + direction], newList[index]];
      await reorderAndSave(newList);
    });
  };

  const startEdit = (g) => {
    setEditId(g.id);
    setFormData({ name: g.name, unit: g.unit || '', title: g.title || '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleExport = async (kind) => {
    if (guests.length === 0) { notify('目前沒有簽到紀錄可匯出', 'error'); return; }
    try {
      if (kind === 'csv') exportGuestsCSV(guests, eventName);
      else await exportGuestsXLSX(guests, eventName);
      notify(`已匯出 ${guests.length} 筆簽到紀錄`);
    } catch (err) {
      notify(`匯出失敗：${err.message}`, 'error');
    }
  };

  const logout = () => {
    sessionStorage.removeItem(AUTH_KEYS.manage);
    navigate('/');
  };

  const formatTime = (isoString) =>
    new Date(isoString).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Taipei', hour12: false });

  const inputClass =
    'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-base text-slate-700 ' +
    'placeholder-slate-400 outline-none transition-all duration-200 ' +
    'focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-200';

  const iconBtn =
    'flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-all duration-200 ' +
    'hover:bg-emerald-100 hover:text-emerald-600 active:scale-95 disabled:opacity-30 disabled:hover:bg-slate-100 disabled:hover:text-slate-500';

  return (
    <div className="min-h-screen bg-slate-50">
      {toast && (
        <div
          className={`fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-full px-5 py-3 text-sm font-bold shadow-lg ${
            toast.type === 'error' ? 'bg-rose-500 text-white' : 'bg-emerald-600 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">青山國小｜簽到處管理</h1>
            <p className="text-sm text-slate-500">目前活動：{eventName}</p>
          </div>
          <div className="flex gap-2 text-sm">
            <Link to="/" className="rounded-full bg-white px-4 py-2 font-bold text-slate-500 shadow-sm ring-1 ring-slate-200 transition-all duration-200 hover:text-emerald-600 active:scale-95">
              前台簽到頁
            </Link>
            <button onClick={logout} className="rounded-full bg-white px-4 py-2 font-bold text-slate-500 shadow-sm ring-1 ring-slate-200 transition-all duration-200 hover:text-rose-500 active:scale-95">
              登出
            </button>
          </div>
        </header>

        {/* 分頁 */}
        <div className="mb-6 flex gap-1 rounded-full bg-slate-200/70 p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 rounded-full px-4 py-2 text-sm font-bold transition-all duration-200 ${
                tab === t.id ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'guests' && (
          <>
            <form onSubmit={handleSubmit} className="mb-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <h2 className="mb-4 text-base font-bold text-slate-700">{editId ? '修改來賓資料' : '手動補登來賓'}</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <input required list="invitation-names" value={formData.name} onChange={handleNameChange} placeholder="姓名" className={inputClass} />
                <input value={formData.unit} onChange={(e) => setFormData({ ...formData, unit: e.target.value })} placeholder="單位" className={inputClass} />
                <input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="職稱" className={inputClass} />
              </div>
              <datalist id="invitation-names">
                {invitations.slice(0, 500).map((i) => <option key={i.id} value={i.name} />)}
              </datalist>
              <div className="mt-4 flex gap-2">
                <button type="submit" disabled={busy} className="rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-bold text-white transition-all duration-200 hover:bg-emerald-600 active:scale-95 disabled:opacity-60">
                  {editId ? '儲存修改' : '補登簽到'}
                </button>
                {editId && (
                  <button type="button" onClick={cancelEdit} className="rounded-full bg-slate-100 px-6 py-2.5 text-sm font-bold text-slate-500 transition-all duration-200 hover:bg-slate-200 active:scale-95">
                    取消
                  </button>
                )}
              </div>
            </form>

            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="rounded-full bg-white px-3 py-1 text-sm font-bold text-slate-500 shadow-sm ring-1 ring-slate-200">
                已簽到 {guests.length} 位
              </span>
              <div className="flex gap-2">
                <button onClick={() => handleExport('xlsx')} className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-bold text-white shadow-sm transition-all duration-200 hover:bg-emerald-600 active:scale-95">
                  ⬇ 匯出 Excel
                </button>
                <button onClick={() => handleExport('csv')} className="rounded-full bg-white px-4 py-2 text-sm font-bold text-emerald-600 shadow-sm ring-1 ring-emerald-200 transition-all duration-200 hover:bg-emerald-50 active:scale-95">
                  ⬇ 匯出 CSV
                </button>
              </div>
            </div>

            {guests.length === 0 ? (
              <div className="rounded-2xl bg-white py-12 text-center text-slate-400 shadow-sm ring-1 ring-slate-200">尚無來賓簽到</div>
            ) : (
              <ul className="space-y-3">
                {guests.map((g, idx) => (
                  <li
                    key={g.id}
                    className={`flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 transition-all duration-200 sm:flex-row sm:items-center sm:justify-between ${
                      editId === g.id ? 'ring-2 ring-amber-300' : 'ring-slate-200'
                    }`}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-base font-bold text-emerald-600">{g.seq_num}</div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <span className="text-base font-bold text-slate-800">{g.name}</span>
                          <span className="text-sm text-slate-500">{[g.unit, g.title].filter(Boolean).join(' ')}</span>
                        </div>
                        <div className="text-xs text-slate-400">簽到 {formatTime(g.sign_in_time)}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button onClick={() => moveGuest(idx, -1)} disabled={busy || idx === 0} className={iconBtn} aria-label="上移">↑</button>
                      <button onClick={() => moveGuest(idx, 1)} disabled={busy || idx === guests.length - 1} className={iconBtn} aria-label="下移">↓</button>
                      <button onClick={() => startEdit(g)} className="rounded-full bg-amber-100 px-4 py-2 text-sm font-bold text-amber-700 transition-all duration-200 hover:bg-amber-200 active:scale-95">編輯</button>
                      <button onClick={() => handleDelete(g.id, g.name)} disabled={busy} className="rounded-full bg-rose-100 px-4 py-2 text-sm font-bold text-rose-600 transition-all duration-200 hover:bg-rose-200 active:scale-95 disabled:opacity-50">刪除</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {tab === 'invitations' && (
          <InvitationPanel invitations={invitations} reload={loadInvitations} notify={notify} />
        )}

        {tab === 'settings' && (
          <SettingsPanel
            eventName={eventName}
            onEventNameChange={setEventName}
            guestCount={guests.length}
            invitationCount={invitations.length}
            onExport={handleExport}
            onReset={reloadAll}
            notify={notify}
          />
        )}
      </div>
    </div>
  );
}
