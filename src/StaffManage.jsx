import { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';

const emptyForm = { name: '', unit: '', title: '' };

export default function StaffManage() {
  const [guests, setGuests] = useState([]);
  const [formData, setFormData] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  useEffect(() => {
    fetchGuests();
    // 每 5 秒同步一次，讓前台平板新增的來賓能即時出現
    const interval = setInterval(() => {
      if (!busyRef.current) fetchGuests();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchGuests = async () => {
    const { data } = await supabase
      .from('cssign_guests')
      .select('*')
      .order('seq_num', { ascending: true });
    setGuests(data || []);
  };

  // 搜尋邀請名單帶入
  const handleNameChange = async (e) => {
    const name = e.target.value;
    setFormData((prev) => ({ ...prev, name }));
    if (!editId && name.trim().length >= 2) {
      const { data } = await supabase
        .from('cssign_invitations')
        .select('*')
        .eq('name', name.trim())
        .limit(1)
        .maybeSingle();
      if (data) setFormData({ name: data.name, unit: data.unit || '', title: data.title || '' });
    }
  };

  // 重新編排為 1 開始的連續序號並回存
  const reorderAndSave = async (updatedList) => {
    const reordered = updatedList.map((g, index) => ({ ...g, seq_num: index + 1 }));
    setGuests(reordered);
    // 只更新有變動的列
    const changed = reordered.filter((g) => {
      const old = guests.find((o) => o.id === g.id);
      return !old || old.seq_num !== g.seq_num;
    });
    await Promise.all(
      changed.map((g) => supabase.from('cssign_guests').update({ seq_num: g.seq_num }).eq('id', g.id))
    );
  };

  const withBusy = async (fn) => {
    busyRef.current = true;
    setBusy(true);
    try {
      await fn();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    withBusy(async () => {
      if (editId) {
        await supabase
          .from('cssign_guests')
          .update({ name: formData.name.trim(), unit: formData.unit.trim(), title: formData.title.trim() })
          .eq('id', editId);
        setEditId(null);
      } else {
        // 手動補登：取最大 seq_num + 1
        const { data: last } = await supabase
          .from('cssign_guests')
          .select('seq_num')
          .order('seq_num', { ascending: false })
          .limit(1)
          .maybeSingle();
        const nextSeq = last ? last.seq_num + 1 : 1;
        await supabase.from('cssign_guests').insert([
          {
            seq_num: nextSeq,
            name: formData.name.trim(),
            unit: formData.unit.trim(),
            title: formData.title.trim(),
          },
        ]);
      }
      setFormData(emptyForm);
      await fetchGuests();
    });
  };

  const cancelEdit = () => {
    setEditId(null);
    setFormData(emptyForm);
  };

  const handleDelete = (id, name) => {
    if (!window.confirm(`確定要刪除來賓 ${name} 嗎？`)) return;
    withBusy(async () => {
      await supabase.from('cssign_guests').delete().eq('id', id);
      const remaining = guests.filter((g) => g.id !== id);
      await reorderAndSave(remaining);
      if (editId === id) cancelEdit();
    });
  };

  const moveGuest = (index, direction) => {
    if ((direction === -1 && index === 0) || (direction === 1 && index === guests.length - 1)) return;
    withBusy(async () => {
      const newList = [...guests];
      const temp = newList[index];
      newList[index] = newList[index + direction];
      newList[index + direction] = temp;
      await reorderAndSave(newList);
    });
  };

  const startEdit = (g) => {
    setEditId(g.id);
    setFormData({ name: g.name, unit: g.unit || '', title: g.title || '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const formatTime = (isoString) =>
    new Date(isoString).toLocaleTimeString('zh-TW', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Taipei',
      hour12: false,
    });

  const inputClass =
    'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-base text-slate-700 ' +
    'placeholder-slate-400 outline-none transition-all duration-200 ' +
    'focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-200';

  const iconBtn =
    'flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-all duration-200 ' +
    'hover:bg-emerald-100 hover:text-emerald-600 active:scale-95 disabled:opacity-30 disabled:hover:bg-slate-100 disabled:hover:text-slate-500';

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-800">青山國小｜簽到處管理</h1>
          <span className="rounded-full bg-white px-3 py-1 text-sm font-bold text-slate-500 shadow-sm ring-1 ring-slate-200">
            共 {guests.length} 位
          </span>
        </header>

        {/* 手動補登 / 修改表單 */}
        <form onSubmit={handleSubmit} className="mb-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="mb-4 text-base font-bold text-slate-700">
            {editId ? '修改來賓資料' : '手動補登來賓'}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <input required value={formData.name} onChange={handleNameChange} placeholder="姓名" className={inputClass} />
            <input
              value={formData.unit}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              placeholder="單位"
              className={inputClass}
            />
            <input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="職稱"
              className={inputClass}
            />
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-bold text-white transition-all duration-200 hover:bg-emerald-600 active:scale-95 disabled:opacity-60"
            >
              {editId ? '儲存修改' : '補登簽到'}
            </button>
            {editId && (
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-full bg-slate-100 px-6 py-2.5 text-sm font-bold text-slate-500 transition-all duration-200 hover:bg-slate-200 active:scale-95"
              >
                取消
              </button>
            )}
          </div>
        </form>

        {/* 名單 */}
        {guests.length === 0 ? (
          <div className="rounded-2xl bg-white py-12 text-center text-slate-400 shadow-sm ring-1 ring-slate-200">
            尚無來賓簽到
          </div>
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
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-base font-bold text-emerald-600">
                    {g.seq_num}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-base font-bold text-slate-800">{g.name}</span>
                      <span className="text-sm text-slate-500">{[g.unit, g.title].filter(Boolean).join(' ')}</span>
                    </div>
                    <div className="text-xs text-slate-400">簽到 {formatTime(g.sign_in_time)}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button onClick={() => moveGuest(idx, -1)} disabled={busy || idx === 0} className={iconBtn} aria-label="上移">
                    ↑
                  </button>
                  <button
                    onClick={() => moveGuest(idx, 1)}
                    disabled={busy || idx === guests.length - 1}
                    className={iconBtn}
                    aria-label="下移"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => startEdit(g)}
                    className="rounded-full bg-amber-100 px-4 py-2 text-sm font-bold text-amber-700 transition-all duration-200 hover:bg-amber-200 active:scale-95"
                  >
                    編輯
                  </button>
                  <button
                    onClick={() => handleDelete(g.id, g.name)}
                    disabled={busy}
                    className="rounded-full bg-rose-100 px-4 py-2 text-sm font-bold text-rose-600 transition-all duration-200 hover:bg-rose-200 active:scale-95 disabled:opacity-50"
                  >
                    刪除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
