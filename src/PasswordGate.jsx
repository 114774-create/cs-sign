import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchSettings } from './settings';

// 簡易密碼閘門：密碼存在 Supabase 設定表，可在管理後台修改
export default function PasswordGate({ storageKey, title, remember = false, children }) {
  const store = remember ? window.localStorage : window.sessionStorage;
  const [status, setStatus] = useState('loading');
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const s = await fetchSettings();
      if (alive) setStatus(store.getItem(storageKey) === s.password ? 'open' : 'locked');
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setChecking(true);
    setError('');
    const s = await fetchSettings();
    if (input === s.password) {
      store.setItem(storageKey, s.password);
      setStatus('open');
    } else {
      setError('密碼錯誤，請再試一次。');
      setInput('');
    }
    setChecking(false);
  };

  if (status === 'loading') {
    return <div className="flex min-h-screen items-center justify-center text-slate-400">載入中...</div>;
  }
  if (status === 'open') return children;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#f2fdfa] to-white px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-[2rem] bg-white p-8 text-center shadow-xl shadow-emerald-100/70 ring-1 ring-emerald-50"
      >
        <div className="mb-2 text-4xl">🔒</div>
        <h1 className="mb-1 text-xl font-black text-slate-800">{title}</h1>
        <p className="mb-6 text-sm text-slate-500">請輸入密碼以繼續</p>
        <input
          type="password"
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="密碼"
          className="w-full rounded-2xl bg-slate-100 px-5 py-3.5 text-center text-lg tracking-widest text-slate-700 outline-none transition-all duration-300 focus:bg-white focus:ring-2 focus:ring-emerald-400"
        />
        {error && <p className="mt-3 text-sm font-bold text-rose-500">{error}</p>}
        <button
          type="submit"
          disabled={checking || !input}
          className="mt-5 w-full rounded-full bg-emerald-500 px-6 py-3 text-base font-bold text-white shadow-lg shadow-emerald-300/50 transition-all duration-300 hover:bg-emerald-600 active:scale-95 disabled:opacity-60"
        >
          {checking ? '驗證中...' : '進入'}
        </button>
        <Link to="/" className="mt-4 block text-sm text-slate-400 transition-colors hover:text-emerald-600">
          ← 回簽到頁
        </Link>
      </form>
    </div>
  );
}
