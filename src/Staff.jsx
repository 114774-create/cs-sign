import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function Staff() {
  const [guests, setGuests] = useState([]);
  const [formData, setFormData] = useState({ name: '', unit: '', title: '' });
  const [editId, setEditId] = useState(null);

  useEffect(() => { fetchGuests(); }, []);

  const fetchGuests = async () => {
    const { data } = await supabase.from('cssign_guests').select('*').order('seq_num', { ascending: true });
    setGuests(data || []);
  };

  // 搜尋邀請名單帶入
  const handleNameChange = async (e) => {
    const name = e.target.value;
    setFormData({ ...formData, name });
    if (name.length >= 2) {
      const { data } = await supabase.from('cssign_invitations').select('*').eq('name', name).single();
      if (data) setFormData({ name: data.name, unit: data.unit, title: data.title });
    }
  };

  // 重新整理並儲存連續序號
  const reorderAndSave = async (updatedList) => {
    const reordered = updatedList.map((g, index) => ({ ...g, seq_num: index + 1 }));
    setGuests(reordered);
    await supabase.from('cssign_guests').upsert(reordered.map(({ id, seq_num }) => ({ id, seq_num })));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editId) {
      await supabase.from('cssign_guests').update({
        name: formData.name, unit: formData.unit, title: formData.title
      }).eq('id', editId);
      setEditId(null);
    } else {
      const nextSeq = guests.length > 0 ? guests[guests.length - 1].seq_num + 1 : 1;
      await supabase.from('cssign_guests').insert([{ ...formData, seq_num: nextSeq }]);
    }
    setFormData({ name: '', unit: '', title: '' });
    fetchGuests();
  };

  const cancelEdit = () => {
    setEditId(null);
    setFormData({ name: '', unit: '', title: '' });
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`確定要刪除來賓 ${name} 嗎？`)) {
      await supabase.from('cssign_guests').delete().eq('id', id);
      const remaining = guests.filter(g => g.id !== id);
      await reorderAndSave(remaining);
    }
  };

  const moveGuest = async (index, direction) => {
    if ((direction === -1 && index === 0) || (direction === 1 && index === guests.length - 1)) return;
    const newList = [...guests];
    const temp = newList[index];
    newList[index] = newList[index + direction];
    newList[index + direction] = temp;
    await reorderAndSave(newList);
  };

  const formatTime = (isoString) => {
    return new Date(isoString).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Taipei', hour12: false });
  };

  const inputClass =
    'w-full rounded-2xl bg-slate-100/80 px-4 py-3 text-base text-slate-700 placeholder-slate-400 ' +
    'border border-transparent outline-none transition-all duration-300 ease-out ' +
    'focus:bg-white focus:border-emerald-300 focus:ring-2 focus:ring-emerald-300/60 ' +
    'focus:shadow-lg focus:shadow-emerald-200/40';

  const iconBtn =
    'flex h-10 w-10 items-center justify-center rounded-full text-base font-bold ' +
    'transition-all duration-300 ease-out active:scale-95';

  const pillBtn =
    'rounded-full px-4 py-2 text-sm font-bold ' +
    'transition-all duration-300 ease-out active:scale-95';

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      {/* 標題區 */}
      <header className="mb-10 animate-fade-up text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-1.5 text-sm font-bold text-emerald-600 shadow-sm shadow-emerald-100 ring-1 ring-white/80 backdrop-blur">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          校慶活動進行中
        </div>
        <h1 className="text-3xl font-black tracking-wide text-slate-800 sm:text-4xl">
          青山國小
          <span className="bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent"> 簽到處</span>
        </h1>
        <p className="mt-2 text-slate-500">歡迎蒞臨校慶，請協助來賓完成簽到</p>
      </header>

      {/* 簽到表單卡片 */}
      <form
        onSubmit={handleSubmit}
        className="mb-10 animate-fade-up rounded-3xl border border-white/60 bg-white/80 p-6 shadow-xl shadow-emerald-200/40 backdrop-blur-md transition-all duration-300 ease-out hover:shadow-2xl hover:shadow-emerald-200/50 sm:p-8"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-700">
            {editId ? '✏️ 編輯來賓資料' : '✍️ 來賓簽到'}
          </h2>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-600">
            已簽到 {guests.length} 位
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <input
            required
            value={formData.name}
            onChange={handleNameChange}
            placeholder="姓名"
            className={inputClass}
          />
          <input
            value={formData.unit}
            onChange={e => setFormData({ ...formData, unit: e.target.value })}
            placeholder="單位"
            className={inputClass}
          />
          <input
            value={formData.title}
            onChange={e => setFormData({ ...formData, title: e.target.value })}
            placeholder="職稱"
            className={inputClass}
          />
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="submit"
            className="flex-1 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-3 text-base font-bold text-white shadow-lg shadow-emerald-300/50 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-xl hover:shadow-emerald-300/60 active:scale-95"
          >
            {editId ? '更新資料' : '確認簽到'}
          </button>
          {editId && (
            <button
              type="button"
              onClick={cancelEdit}
              className="rounded-full bg-slate-100 px-6 py-3 text-base font-bold text-slate-500 transition-all duration-300 ease-out hover:bg-slate-200 active:scale-95"
            >
              取消
            </button>
          )}
        </div>
      </form>

      {/* 名單列表 */}
      {guests.length === 0 ? (
        <div className="animate-fade-up rounded-3xl border border-dashed border-emerald-200 bg-white/50 py-16 text-center text-slate-400">
          <div className="mb-2 text-4xl">🌿</div>
          尚無來賓簽到
        </div>
      ) : (
        <ul className="space-y-4">
          {guests.map((g, idx) => (
            <li
              key={g.id}
              className="flex flex-col gap-4 rounded-3xl border border-white/60 bg-white/80 p-5 shadow-lg shadow-emerald-100/60 backdrop-blur-md transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-2xl hover:shadow-emerald-200/60 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 flex-1 items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 text-lg font-black text-white shadow-md shadow-emerald-300/50">
                  {g.seq_num}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-lg font-bold text-slate-800">{g.name}</span>
                    <span className="text-sm text-slate-500">
                      {[g.unit, g.title].filter(Boolean).join(' ')}
                    </span>
                  </div>
                  <div className="mt-0.5 inline-flex items-center gap-1 text-sm text-amber-500">
                    🕐 {formatTime(g.sign_in_time)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  onClick={() => moveGuest(idx, -1)}
                  disabled={idx === 0}
                  className={`${iconBtn} bg-slate-100 text-slate-500 hover:bg-emerald-100 hover:text-emerald-600 disabled:opacity-30 disabled:hover:bg-slate-100 disabled:hover:text-slate-500`}
                  aria-label="上移"
                >
                  ↑
                </button>
                <button
                  onClick={() => moveGuest(idx, 1)}
                  disabled={idx === guests.length - 1}
                  className={`${iconBtn} bg-slate-100 text-slate-500 hover:bg-emerald-100 hover:text-emerald-600 disabled:opacity-30 disabled:hover:bg-slate-100 disabled:hover:text-slate-500`}
                  aria-label="下移"
                >
                  ↓
                </button>
                <button
                  onClick={() => {
                    setEditId(g.id);
                    setFormData({ name: g.name, unit: g.unit || '', title: g.title || '' });
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className={`${pillBtn} bg-amber-100 text-amber-700 hover:bg-amber-200 hover:shadow-md hover:shadow-amber-200/60`}
                >
                  編輯
                </button>
                <button
                  onClick={() => handleDelete(g.id, g.name)}
                  className={`${pillBtn} bg-rose-100 text-rose-600 hover:bg-rose-200 hover:shadow-md hover:shadow-rose-200/60`}
                >
                  刪除
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
