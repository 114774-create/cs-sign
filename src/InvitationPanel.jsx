import { useState, useMemo, useRef } from 'react';
import { supabase } from './supabaseClient';
import { insertInvitations, clearTable } from './api';
import { parseListFile, rowsToInvitees, downloadTemplate } from './fileUtils';

const keyOf = (i) => `${i.name}|${i.unit || ''}|${i.title || ''}`;
const SHOW_LIMIT = 200;

export default function InvitationPanel({ invitations, reload, notify }) {
  const [form, setForm] = useState({ name: '', unit: '', title: '' });
  const [adding, setAdding] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [preview, setPreview] = useState(null);
  const [replaceFirst, setReplaceFirst] = useState(false);
  const [importing, setImporting] = useState(false);
  const [filter, setFilter] = useState('');
  const fileRef = useRef(null);

  const inputClass =
    'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-base text-slate-700 ' +
    'placeholder-slate-400 outline-none transition-all duration-200 ' +
    'focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-200';

  const filtered = useMemo(() => {
    const q = filter.trim();
    if (!q) return invitations;
    return invitations.filter(
      (i) => i.name.includes(q) || (i.unit || '').includes(q) || (i.title || '').includes(q)
    );
  }, [filter, invitations]);

  // ---------- 單筆新增 ----------
  const handleAdd = async (e) => {
    e.preventDefault();
    const row = { name: form.name.trim(), unit: form.unit.trim(), title: form.title.trim() };
    if (!row.name) return;
    if (invitations.some((i) => keyOf(i) === keyOf(row))) {
      notify('名單中已有相同的來賓資料', 'error');
      return;
    }
    setAdding(true);
    const { error } = await supabase.from('cssign_invitations').insert([row]);
    setAdding(false);
    if (error) { notify(`新增失敗：${error.message}`, 'error'); return; }
    setForm({ name: '', unit: '', title: '' });
    await reload();
    notify(`已加入 ${row.name}`);
  };

  const handleDelete = async (i) => {
    if (!window.confirm(`從邀請名單移除 ${i.name} 嗎？`)) return;
    const { error } = await supabase.from('cssign_invitations').delete().eq('id', i.id);
    if (error) { notify(`刪除失敗：${error.message}`, 'error'); return; }
    await reload();
  };

  // ---------- 檔案上傳 ----------
  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setParsing(true);
    setPreview(null);
    try {
      const { rows, encoding } = await parseListFile(file);
      setPreview({ fileName: file.name, encoding, ...rowsToInvitees(rows) });
    } catch (err) {
      setPreview({ fileName: file.name, fatal: err.message });
    } finally {
      setParsing(false);
    }
  };

  const doImport = async () => {
    if (!preview?.invitees?.length) return;
    const existing = new Set(invitations.map(keyOf));
    const toInsert = replaceFirst ? preview.invitees : preview.invitees.filter((i) => !existing.has(keyOf(i)));
    const skipped = preview.invitees.length - toInsert.length;
    if (toInsert.length === 0) {
      notify('檔案內的來賓都已在名單中，沒有需要匯入的資料', 'error');
      return;
    }
    if (
      replaceFirst &&
      !window.confirm(`將先清空現有 ${invitations.length} 筆邀請名單，再匯入 ${toInsert.length} 筆。確定嗎？`)
    ) {
      return;
    }
    setImporting(true);
    try {
      if (replaceFirst) await clearTable('cssign_invitations');
      await insertInvitations(toInsert);
      await reload();
      setPreview(null);
      setReplaceFirst(false);
      notify(`已匯入 ${toInsert.length} 筆${skipped ? `，略過 ${skipped} 筆重複` : ''}`);
    } catch (err) {
      notify(`匯入失敗：${err.message}`, 'error');
      await reload();
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 檔案上傳 */}
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="mb-1 text-base font-bold text-slate-700">上傳邀請名單</h2>
        <p className="mb-4 text-sm text-slate-500">
          支援 .csv、.txt、.xlsx、.xls；欄位順序為「姓名、單位、職稱」，第一列可有標題列。
          Big5 編碼的 CSV 會自動轉換。
        </p>
        <div className="flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept=".csv,.txt,.tsv,.xlsx,.xls" onChange={handleFile} className="hidden" />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={parsing}
            className="rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white transition-all duration-200 hover:bg-emerald-600 active:scale-95 disabled:opacity-60"
          >
            {parsing ? '讀取中...' : '📁 選擇檔案'}
          </button>
          <button
            type="button"
            onClick={downloadTemplate}
            className="rounded-full bg-slate-100 px-5 py-2.5 text-sm font-bold text-slate-600 transition-all duration-200 hover:bg-slate-200 active:scale-95"
          >
            下載範本
          </button>
        </div>

        {preview && (
          <div className="mt-5 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
            <div className="mb-2 text-sm font-bold text-slate-700">
              {preview.fileName}
              {preview.encoding && <span className="ml-2 font-normal text-slate-400">（編碼：{preview.encoding}）</span>}
            </div>

            {preview.fatal ? (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-bold text-rose-600">{preview.fatal}</p>
            ) : (
              <>
                <p className="text-sm text-slate-600">
                  可匯入 <b className="text-emerald-600">{preview.invitees.length}</b> 筆
                  {preview.duplicates > 0 && <>，檔案內重複 {preview.duplicates} 筆已略過</>}
                  {preview.errors.length > 0 && (
                    <>，<b className="text-rose-500">{preview.errors.length}</b> 筆格式有問題</>
                  )}
                </p>

                {preview.errors.length > 0 && (
                  <ul className="mt-3 space-y-1 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">
                    {preview.errors.slice(0, 10).map((er, idx) => (
                      <li key={idx}>{er.line ? `第 ${er.line} 列：` : ''}{er.message}</li>
                    ))}
                    {preview.errors.length > 10 && <li>…還有 {preview.errors.length - 10} 筆問題未列出</li>}
                    <li className="pt-1 text-xs text-rose-400">有問題的列不會被匯入，請修正檔案後可重新上傳。</li>
                  </ul>
                )}

                {preview.invitees.length > 0 && (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                      <thead className="text-xs text-slate-400">
                        <tr><th className="py-1 pr-4">姓名</th><th className="py-1 pr-4">單位</th><th className="py-1">職稱</th></tr>
                      </thead>
                      <tbody>
                        {preview.invitees.slice(0, 5).map((r, idx) => (
                          <tr key={idx}><td className="py-0.5 pr-4">{r.name}</td><td className="py-0.5 pr-4">{r.unit}</td><td className="py-0.5">{r.title}</td></tr>
                        ))}
                      </tbody>
                    </table>
                    {preview.invitees.length > 5 && <p className="mt-1 text-xs text-slate-400">僅預覽前 5 筆</p>}
                  </div>
                )}

                <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={replaceFirst}
                    onChange={(e) => setReplaceFirst(e.target.checked)}
                    className="h-4 w-4 accent-emerald-500"
                  />
                  匯入前先清空現有邀請名單（目前 {invitations.length} 筆）
                </label>

                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={doImport}
                    disabled={importing || preview.invitees.length === 0}
                    className="rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white transition-all duration-200 hover:bg-emerald-600 active:scale-95 disabled:opacity-50"
                  >
                    {importing ? '匯入中...' : `確認匯入 ${preview.invitees.length} 筆`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreview(null)}
                    className="rounded-full bg-white px-5 py-2.5 text-sm font-bold text-slate-500 ring-1 ring-slate-200 transition-all duration-200 hover:bg-slate-100 active:scale-95"
                  >
                    取消
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </section>

      {/* 單筆輸入 */}
      <form onSubmit={handleAdd} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="mb-4 text-base font-bold text-slate-700">手動新增來賓</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="姓名" className={inputClass} />
          <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="單位" className={inputClass} />
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="職稱" className={inputClass} />
        </div>
        <button
          type="submit"
          disabled={adding}
          className="mt-4 rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-bold text-white transition-all duration-200 hover:bg-emerald-600 active:scale-95 disabled:opacity-60"
        >
          {adding ? '新增中...' : '加入名單'}
        </button>
      </form>

      {/* 名單 */}
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-bold text-slate-700">
            目前邀請名單 <span className="ml-1 text-sm font-normal text-slate-400">共 {invitations.length} 位</span>
          </h2>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="搜尋姓名、單位、職稱"
            className={`${inputClass} !w-full sm:!w-56`}
          />
        </div>

        {invitations.length === 0 ? (
          <p className="py-8 text-center text-slate-400">尚未建立邀請名單</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.slice(0, SHOW_LIMIT).map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <span className="font-bold text-slate-800">{i.name}</span>
                  <span className="ml-2 text-sm text-slate-500">{[i.unit, i.title].filter(Boolean).join(' ')}</span>
                </div>
                <button
                  onClick={() => handleDelete(i)}
                  className="shrink-0 rounded-full bg-rose-100 px-3 py-1.5 text-xs font-bold text-rose-600 transition-all duration-200 hover:bg-rose-200 active:scale-95"
                >
                  移除
                </button>
              </li>
            ))}
            {filtered.length === 0 && <li className="py-6 text-center text-slate-400">找不到符合的來賓</li>}
          </ul>
        )}
        {filtered.length > SHOW_LIMIT && (
          <p className="mt-3 text-center text-xs text-slate-400">僅顯示前 {SHOW_LIMIT} 筆，請使用搜尋縮小範圍</p>
        )}
      </section>
    </div>
  );
}
