-- 青山國小簽到系統：所有資料表皆使用 cssign_ 前綴，避免與其他專案共用 Supabase 時衝突
-- 可重複執行（已存在的資料表與資料不會被覆蓋）

CREATE TABLE IF NOT EXISTS cssign_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  unit TEXT,
  title TEXT
);

CREATE TABLE IF NOT EXISTS cssign_guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seq_num INTEGER NOT NULL,
  name TEXT NOT NULL,
  unit TEXT,
  title TEXT,
  sign_in_time TIMESTAMPTZ DEFAULT NOW()
);

-- 活動設定（活動名稱、管理密碼）
CREATE TABLE IF NOT EXISTS cssign_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT INTO cssign_settings (key, value) VALUES
  ('event_name', '校慶'),
  ('password', '2026')
ON CONFLICT (key) DO NOTHING;

-- 允許匿名讀寫 (為簡化活動當天無登入操作)
ALTER TABLE cssign_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cssign_guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE cssign_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cssign allow all" ON cssign_invitations;
DROP POLICY IF EXISTS "cssign allow all" ON cssign_guests;
DROP POLICY IF EXISTS "cssign allow all" ON cssign_settings;
CREATE POLICY "cssign allow all" ON cssign_invitations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "cssign allow all" ON cssign_guests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "cssign allow all" ON cssign_settings FOR ALL USING (true) WITH CHECK (true);
