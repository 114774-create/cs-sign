import { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { fetchAll } from './api';
import { fetchSettings } from './settings';

const emptyForm = { name: '', unit: '', title: '' };

export default function SignIn() {
  const [formData, setFormData] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [welcome, setWelcome] = useState('');
  const [error, setError] = useState('');
  const [eventName, setEventName] = useState('校慶');
  const [invitations, setInvitations] = useState([]);
  const [signedNames, setSignedNames] = useState(new Set());
  const [showSuggest, setShowSuggest] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const timerRef = useRef(null);

  // 讀取活動名稱、邀請名單、已簽到姓名（每 20 秒更新一次）
  const loadMeta = async () => {
    try {
      const [settings, inv, signed] = await Promise.all([
        fetchSettings(),
        fetchAll('cssign_invitations', 'id, name, unit, title', ['name', 'id']),
        fetchAll('cssign_guests', 'id, name', ['seq_num', 'id']),
      ]);
      setEventName(settings.eventName);
      setInvitations([...inv].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant')));
      setSignedNames(new Set(signed.map((g) => g.name)));
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadMeta();
    const interval = setInterval(loadMeta, 20000);
    return () => {
      clearInterval(interval);
      clearTimeout(timerRef.current);
    };
  }, []);

  const suggestions = useMemo(() => {
    const q = formData.name.trim();
    if (!q) return [];
    return invitations.filter((i) => i.name.includes(q) || (i.unit || '').includes(q)).slice(0, 6);
  }, [formData.name, invitations]);

  const pickerList = useMemo(() => {
    const q = pickerQuery.trim();
    if (!q) return invitations;
    return invitations.filter((i) => i.name.includes(q) || (i.unit || '').includes(q) || (i.title || '').includes(q));
  }, [pickerQuery, invitations]);

  const selectInvitee = (i) => {
    setFormData({ name: i.name, unit: i.unit || '', title: i.title || '' });
    setShowSuggest(false);
    setPickerOpen(false);
    setPickerQuery('');
  };

  // 輸入姓名：若與邀請名單唯一相符，自動帶入單位與職稱
  const handleNameChange = (e) => {
    const name = e.target.value;
    const exact = invitations.filter((i) => i.name === name.trim());
    if (name.trim().length >= 2 && exact.length === 1) {
      setFormData({ name: exact[0].name, unit: exact[0].unit || '', title: exact[0].title || '' });
    } else {
      setFormData((prev) => ({ ...prev, name }));
    }
    setShowSuggest(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    const guestName = formData.name.trim();
    if (signedNames.has(guestName) && !window.confirm(`${guestName} 似乎已經簽到過了，仍要再簽到一次嗎？`)) {
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      // 取得目前最大的 seq_num，+1 寫入
      const { data: last, error: seqError } = await supabase
        .from('cssign_guests')
        .select('seq_num')
        .order('seq_num', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (seqError) throw seqError;
      const nextSeq = last ? last.seq_num + 1 : 1;

      const { error: insertError } = await supabase.from('cssign_guests').insert([
        {
          seq_num: nextSeq,
          name: guestName,
          unit: formData.unit.trim(),
          title: formData.title.trim(),
        },
      ]);
      if (insertError) throw insertError;

      setFormData(emptyForm);
      setShowSuggest(false);
      setWelcome(`歡迎 ${guestName}！簽到成功。`);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setWelcome(''), 3000);
      loadMeta();
    } catch (err) {
      console.error(err);
      setError('簽到失敗，請再試一次或洽詢工作人員。');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full rounded-2xl bg-slate-100 px-5 py-4 text-lg text-slate-700 placeholder-slate-400 ' +
    'border-0 outline-none transition-all duration-300 ease-out ' +
    'focus:bg-white focus:ring-2 focus:ring-emerald-400 focus:shadow-lg focus:shadow-emerald-100';

  const showList =
    showSuggest &&
    suggestions.length > 0 &&
    !(suggestions.length === 1 && suggestions[0].name === formData.name.trim() && (suggestions[0].unit || '') === formData.unit);

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-b from-[#f2fdfa] to-white px-4 py-10">
      {/* 右上角：工作人員入口（需密碼）*/}
      <nav className="absolute right-4 top-4 flex gap-2 text-sm">
        <Link
          to="/manage"
          className="rounded-full bg-white/80 px-4 py-2 font-bold text-slate-500 shadow-sm ring-1 ring-slate-200 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:text-emerald-600 active:scale-95"
        >
          ⚙️ 簽到處管理
        </Link>
        <Link
          to="/principal"
          className="rounded-full bg-white/80 px-4 py-2 font-bold text-slate-500 shadow-sm ring-1 ring-slate-200 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:text-emerald-600 active:scale-95"
        >
          📋 校長查閱
        </Link>
      </nav>

      <div className="w-full max-w-xl">
        <header className="mb-8 mt-8 text-center sm:mt-0">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-bold text-emerald-600 shadow-sm shadow-emerald-100 ring-1 ring-emerald-100">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400" />
            {eventName}活動進行中
          </div>
          <h1 className="text-4xl font-black tracking-wide text-slate-800 sm:text-5xl">
            青山國小
            <span className="text-emerald-500"> 簽到處</span>
          </h1>
          <p className="mt-3 text-lg text-slate-500">歡迎蒞臨{eventName}，請協助來賓完成簽到</p>
        </header>

        <div className="mb-4 min-h-[3.5rem]">
          {welcome && (
            <div className="animate-fade-up rounded-2xl bg-emerald-50 px-5 py-4 text-center text-lg font-bold text-emerald-600 ring-1 ring-emerald-200">
              {welcome}
            </div>
          )}
          {error && (
            <div className="animate-fade-up rounded-2xl bg-rose-50 px-5 py-4 text-center text-base font-bold text-rose-500 ring-1 ring-rose-200">
              {error}
            </div>
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-[2rem] bg-white p-8 shadow-xl shadow-emerald-100/70 ring-1 ring-emerald-50 sm:p-10"
        >
          <div className="mb-6 flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-slate-700">✍️ 來賓簽到</h2>
            {invitations.length > 0 && (
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-600 transition-all duration-300 ease-out hover:bg-emerald-100 active:scale-95"
              >
                📋 從邀請名單選擇
              </button>
            )}
          </div>

          <div className="space-y-4">
            <div className="relative">
              <input
                required
                value={formData.name}
                onChange={handleNameChange}
                onFocus={() => setShowSuggest(true)}
                onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
                placeholder="姓名"
                autoComplete="off"
                className={inputClass}
              />
              {showList && (
                <ul className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-2xl bg-white shadow-xl shadow-emerald-100 ring-1 ring-emerald-100">
                  {suggestions.map((i) => (
                    <li key={i.id}>
                      <button
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); selectInvitee(i); }}
                        className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left transition-colors duration-200 hover:bg-emerald-50"
                      >
                        <span>
                          <span className="text-lg font-bold text-slate-800">{i.name}</span>
                          <span className="ml-2 text-sm text-slate-500">{[i.unit, i.title].filter(Boolean).join(' ')}</span>
                        </span>
                        {signedNames.has(i.name) && (
                          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-400">已簽到</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <input
              value={formData.unit}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              placeholder="單位"
              autoComplete="off"
              className={inputClass}
            />
            <input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="職稱"
              autoComplete="off"
              className={inputClass}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-8 w-full rounded-full bg-emerald-500 px-6 py-4 text-xl font-bold text-white shadow-lg shadow-emerald-300/60 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-emerald-600 hover:shadow-xl hover:shadow-emerald-300/70 active:scale-95 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
          >
            {submitting ? '處理中...' : '確認簽到'}
          </button>
        </form>
      </div>

      {/* 邀請名單快選 */}
      {pickerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
          onClick={() => setPickerOpen(false)}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-xl flex-col rounded-[2rem] bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-700">📋 邀請名單（點選即可帶入）</h3>
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-all duration-300 hover:bg-slate-200 active:scale-95"
                aria-label="關閉"
              >
                ✕
              </button>
            </div>
            <input
              value={pickerQuery}
              onChange={(e) => setPickerQuery(e.target.value)}
              placeholder="搜尋姓名、單位或職稱"
              className={`${inputClass} mb-4 py-3 text-base`}
            />
            <ul className="-mr-2 flex-1 space-y-2 overflow-y-auto pr-2">
              {pickerList.length === 0 && <li className="py-8 text-center text-slate-400">找不到符合的來賓</li>}
              {pickerList.map((i) => (
                <li key={i.id}>
                  <button
                    type="button"
                    onClick={() => selectInvitee(i)}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl bg-slate-50 px-5 py-3 text-left transition-all duration-300 ease-out hover:bg-emerald-50 active:scale-[0.98]"
                  >
                    <span>
                      <span className="text-lg font-bold text-slate-800">{i.name}</span>
                      <span className="ml-2 text-sm text-slate-500">{[i.unit, i.title].filter(Boolean).join(' ')}</span>
                    </span>
                    {signedNames.has(i.name) && (
                      <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-400">已簽到</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
