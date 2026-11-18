import { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';

const emptyForm = { name: '', unit: '', title: '' };

export default function SignIn() {
  const [formData, setFormData] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [welcome, setWelcome] = useState('');
  const [error, setError] = useState('');
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  // 輸入姓名時，自動帶入邀請名單的單位與職稱
  const handleNameChange = async (e) => {
    const name = e.target.value;
    setFormData((prev) => ({ ...prev, name }));
    if (name.trim().length >= 2) {
      const { data } = await supabase
        .from('cssign_invitations')
        .select('*')
        .eq('name', name.trim())
        .limit(1)
        .maybeSingle();
      if (data) {
        setFormData({ name: data.name, unit: data.unit || '', title: data.title || '' });
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
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

      const guestName = formData.name.trim();
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
      setWelcome(`歡迎 ${guestName}！簽到成功。`);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setWelcome(''), 3000);
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#f2fdfa] to-white px-4 py-10">
      <div className="w-full max-w-xl">
        {/* 標題區 */}
        <header className="mb-8 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-bold text-emerald-600 shadow-sm shadow-emerald-100 ring-1 ring-emerald-100">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400" />
            校慶活動進行中
          </div>
          <h1 className="text-4xl font-black tracking-wide text-slate-800 sm:text-5xl">
            青山國小
            <span className="text-emerald-500"> 簽到處</span>
          </h1>
          <p className="mt-3 text-lg text-slate-500">歡迎蒞臨校慶，請協助來賓完成簽到</p>
        </header>

        {/* 提示訊息 */}
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

        {/* 簽到表單卡片 */}
        <form
          onSubmit={handleSubmit}
          className="rounded-[2rem] bg-white p-8 shadow-xl shadow-emerald-100/70 ring-1 ring-emerald-50 sm:p-10"
        >
          <h2 className="mb-6 text-xl font-bold text-slate-700">✍️ 來賓簽到</h2>

          <div className="space-y-4">
            <input
              required
              value={formData.name}
              onChange={handleNameChange}
              placeholder="姓名"
              autoComplete="off"
              className={inputClass}
            />
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
    </div>
  );
}
