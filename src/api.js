import { supabase } from './supabaseClient';

const PAGE = 1000;

// 分頁讀取整張表（Supabase 預設單次最多回傳 1000 筆）
export async function fetchAll(table, columns = '*', orderBy = ['id']) {
  let all = [];
  let from = 0;
  for (;;) {
    let q = supabase.from(table).select(columns);
    orderBy.forEach((col) => { q = q.order(col, { ascending: true }); });
    const { data, error } = await q.range(from, from + PAGE - 1);
    if (error) throw error;
    all = all.concat(data || []);
    if (!data || data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

export async function insertInvitations(rows) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from('cssign_invitations').insert(rows.slice(i, i + 500));
    if (error) throw error;
  }
}

export async function clearTable(table) {
  const { error } = await supabase.from(table).delete().not('id', 'is', null);
  if (error) throw error;
}
