import { useState, useEffect } from 'react';
import { saveSetting, AUTH_KEYS, SAVE_FAIL_HINT } from './settings';
import { clearTable } from './api';

export default function SettingsPanel({
  eventName, onEventNameChange, guestCount, invitationCount, onExport, onReset, notify,
}) {
  const [nameInput, setNameInput] = useState(eventName);
  const [savingName, setSavingName] = useState(false);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  const [clearGuests, setClearGuests] = useState(true);
  const [clearInv, setClearInv] = useState(true);
  const [newName, setNewName] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [working, setWorking] = useState(false);

  useEffect(() => { setNameInput(eventName); }, [eventName]);

  const inputClass =
    'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-base text-slate-700 ' +
    'placeholder-slate-400 outline-none transition-all duration-200 ' +
    'focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-200';

  const saveName = async (e) => {
    e.preventDefault();
    const v = nameInput.trim();
    if (!v || v.length > 30) { notify('活動名稱需為 1～30 個字', 'error'); return; }
    setSavingName(true);
    const { error } = await saveSetting('event_name', v);
    setSavingName(false);
    if (error) { notify(SAVE_FAIL_HINT, 'error'); return; }
    onEventNameChange(v);
    notify('活動名稱已更新');
  };

  const savePassword = async (e) => {
    e.preventDefault();
    if (pw.length < 4) { notify('密碼至少需要 4 個字元', 'error'); return; }
    if (pw !== pw2) { notify('兩次輸入的密碼不一致', 'error'); return; }
    setSavingPw(true);
    const { error } = await saveSetting('password', pw);
    setSavingPw(false);
    if (error) { notify(SAVE_FAIL_HINT, 'error'); return; }
    sessionStorage.setItem(AUTH_KEYS.manage, pw); // 目前這個分頁維持登入
    setPw(''); setPw2('');
    notify('密碼已更新（校長手機下次開啟需輸入新密碼）');
  };

  const canReset =
    confirmText.trim() === '確認清空' && (clearGuests || clearInv || newName.trim()) && !working;

  const runReset = async () => {
    setWorking(true);
    try {
      if (clearGuests) await clearTable('cssign_guests');
      if (clearInv) await clearTable('cssign_invitations');
      if (newName.trim()) {
        const v = newName.trim().slice(0, 30);
        const { error } = await saveSetting('event_name', v);
        if (error) throw new Error(SAVE_FAIL_HINT);
        onEventNameChange(v);
      }
      setConfirmText('');
      setNewName('');
      await onReset();
      notify('已完成重置，可以開始新的活動');
    } catch (err) {
      notify(`重置失敗：${err.message}`, 'error');
      await onReset();
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={saveName} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="mb-1 text-base font-bold text-slate-700">活動名稱</h2>
        <p className="mb-4 text-sm text-slate-500">
          會顯示在簽到頁（例如「校慶活動進行中」「歡迎蒞臨校慶」）與匯出檔名。每次舉辦新活動可修改。
        </p>
        <div className="flex gap-2">
          <input value={nameInput} onChange={(e) => setNameInput(e.target.value)} maxLength={30} placeholder="例如：校慶、畢業典禮" className={inputClass} />
          <button
            type="submit"
            disabled={savingName}
            className="shrink-0 rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white transition-all duration-200 hover:bg-emerald-600 active:scale-95 disabled:opacity-60"
          >
            {savingName ? '儲存中...' : '儲存'}
          </button>
        </div>
      </form>

      <form onSubmit={savePassword} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="mb-1 text-base font-bold text-slate-700">修改密碼</h2>
        <p className="mb-4 text-sm text-slate-500">此密碼同時用於「簽到處管理」與「校長查閱」頁面。</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="新密碼（至少 4 個字元）" className={inputClass} />
          <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="再輸入一次新密碼" className={inputClass} />
        </div>
        <button
          type="submit"
          disabled={savingPw || !pw}
          className="mt-4 rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white transition-all duration-200 hover:bg-emerald-600 active:scale-95 disabled:opacity-60"
        >
          {savingPw ? '儲存中...' : '更新密碼'}
        </button>
      </form>

      {/* 重置 */}
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-2 ring-rose-200">
        <h2 className="mb-1 text-base font-bold text-rose-600">⚠️ 開始新活動（資料重置）</h2>
        <p className="mb-4 text-sm text-slate-500">
          清除後無法復原。建議先匯出目前的簽到紀錄留存。
        </p>

        <div className="mb-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => onExport('xlsx')} className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600 transition-all duration-200 hover:bg-slate-200 active:scale-95">
            先匯出 Excel
          </button>
          <button type="button" onClick={() => onExport('csv')} className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600 transition-all duration-200 hover:bg-slate-200 active:scale-95">
            先匯出 CSV
          </button>
        </div>

        <div className="space-y-2 text-sm text-slate-700">
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={clearGuests} onChange={(e) => setClearGuests(e.target.checked)} className="h-4 w-4 accent-rose-500" />
            清空簽到紀錄（目前 {guestCount} 筆，序號將從 1 重新開始）
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={clearInv} onChange={(e) => setClearInv(e.target.checked)} className="h-4 w-4 accent-rose-500" />
            清空邀請名單（目前 {invitationCount} 筆）
          </label>
        </div>

        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          maxLength={30}
          placeholder="新活動名稱（選填，同時更新）"
          className={`${inputClass} mt-4`}
        />
        <input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="請輸入「確認清空」以啟用按鈕"
          className={`${inputClass} mt-3`}
        />
        <button
          type="button"
          onClick={runReset}
          disabled={!canReset}
          className="mt-4 rounded-full bg-rose-500 px-6 py-2.5 text-sm font-bold text-white transition-all duration-200 hover:bg-rose-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {working ? '處理中...' : '執行重置'}
        </button>
      </section>
    </div>
  );
}
