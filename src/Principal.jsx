import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { fetchSettings } from './settings';

export default function Principal() {
  const [guests, setGuests] = useState([]);
  const [eventName, setEventName] = useState('');
  const [checkedItems, setCheckedItems] = useState(() => {
    return JSON.parse(localStorage.getItem('principalChecked')) || {};
  });

  useEffect(() => {
    fetchSettings().then((s) => setEventName(s.eventName));
    fetchGuests();
    const interval = setInterval(fetchGuests, 4000); // 每 4 秒自動更新
    return () => clearInterval(interval);
  }, []);

  const fetchGuests = async () => {
    const { data } = await supabase.from('cssign_guests').select('id, seq_num, name, title, sign_in_time').order('seq_num', { ascending: true });
    if (data) {
      setGuests(data);
      // 清除已不存在的來賓的勾選紀錄（例如活動重置後）
      setCheckedItems((prev) => {
        const ids = new Set(data.map((g) => g.id));
        const next = {};
        let changed = false;
        Object.keys(prev).forEach((k) => { if (ids.has(k)) next[k] = prev[k]; else changed = true; });
        if (changed) localStorage.setItem('principalChecked', JSON.stringify(next));
        return changed ? next : prev;
      });
    }
  };

  const toggleCheck = (id) => {
    const newChecked = { ...checkedItems, [id]: !checkedItems[id] };
    setCheckedItems(newChecked);
    localStorage.setItem('principalChecked', JSON.stringify(newChecked));
  };

  const formatTime = (isoString) => {
    return new Date(isoString).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Taipei', hour12: false });
  };

  const checkedCount = guests.filter(g => checkedItems[g.id]).length;

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      {/* 標題 */}
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-black tracking-wide text-slate-800">
          校長
          <span className="bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent"> 查閱名單</span>
        </h1>
        {eventName && <p className="mt-1 text-sm text-slate-500">青山國小 {eventName}</p>}
        <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-1.5 text-sm font-bold text-emerald-600 shadow-sm shadow-emerald-100 ring-1 ring-white/80">
          已確認 {checkedCount} / {guests.length}
        </div>
      </header>

      {guests.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-emerald-200 bg-white/50 py-14 text-center text-slate-400">
          <div className="mb-2 text-4xl">🌿</div>
          尚無來賓簽到
        </div>
      ) : (
        <div className="space-y-4">
          {guests.map(g => {
            const checked = !!checkedItems[g.id];
            return (
              <label
                key={g.id}
                className={`flex cursor-pointer items-start gap-4 rounded-3xl border p-4 shadow-lg backdrop-blur-md transition-all duration-300 ease-out active:scale-[0.98] ${
                  checked
                    ? 'border-emerald-200 bg-emerald-50/80 shadow-emerald-200/50'
                    : 'border-white/60 bg-white/85 shadow-emerald-100/60 hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-200/60'
                }`}
              >
                {/* 隱藏原生 checkbox，自訂圓形勾選框 */}
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleCheck(g.id)}
                  className="peer sr-only"
                />
                <span
                  className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300 ease-out ${
                    checked
                      ? 'border-transparent bg-gradient-to-br from-emerald-400 to-teal-500 shadow-lg shadow-emerald-300/70 ring-4 ring-emerald-100'
                      : 'border-slate-300 bg-white'
                  }`}
                  aria-hidden="true"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className={`h-5 w-5 text-white transition-all duration-300 ease-out ${
                      checked ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
                    }`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                </span>

                <div className="min-w-0 flex-1">
                  {/* 姓名與職稱緊接，22px，以粗細與顏色分出層次 */}
                  <div
                    className={`break-words text-[22px] leading-tight transition-colors duration-300 ${
                      checked ? 'text-slate-400' : 'text-slate-800'
                    }`}
                  >
                    <span className="mr-1 font-black text-emerald-500">{g.seq_num}.</span>
                    <span className="font-black">{g.name}</span>
                    {g.title && (
                      <span className={`ml-1 font-medium ${checked ? 'text-slate-400' : 'text-slate-500'}`}>
                        {g.title}
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-sm font-medium text-amber-600">
                    🕐 {formatTime(g.sign_in_time)}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
