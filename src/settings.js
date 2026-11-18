import { supabase } from './supabaseClient';

export const DEFAULTS = { event_name: '校慶', password: '2026' };

// 登入狀態儲存用的 key
export const AUTH_KEYS = { manage: 'cssign_auth_manage', principal: 'cssign_auth_principal' };

export const SAVE_FAIL_HINT = '儲存失敗，請確認已在 Supabase 重新執行最新版 supabase/schema.sql。';

// 讀取活動設定；資料表不存在或讀取失敗時退回預設值
export async function fetchSettings() {
  const { data, error } = await supabase.from('cssign_settings').select('key, value');
  const s = { ...DEFAULTS };
  if (!error && data) data.forEach((r) => { s[r.key] = r.value; });
  return { eventName: s.event_name, password: s.password, ok: !error };
}

export async function saveSetting(key, value) {
  return supabase.from('cssign_settings').upsert({ key, value }, { onConflict: 'key' });
}
