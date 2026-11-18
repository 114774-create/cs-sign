-- 青山國小校慶簽到系統：所有資料表皆使用 cssign_ 前綴，避免與其他專案共用 Supabase 時衝突

-- 建立邀請名單
CREATE TABLE cssign_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  unit TEXT,
  title TEXT
);

-- 建立簽到紀錄 (seq_num 控制從 1 開始的連續編號)
CREATE TABLE cssign_guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seq_num INTEGER NOT NULL,
  name TEXT NOT NULL,
  unit TEXT,
  title TEXT,
  sign_in_time TIMESTAMPTZ DEFAULT NOW()
);

-- 允許匿名讀寫 (為簡化校慶當天無登入操作，實務上可加上 RLS 政策)
ALTER TABLE cssign_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cssign_guests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cssign allow all" ON cssign_invitations FOR ALL USING (true);
CREATE POLICY "cssign allow all" ON cssign_guests FOR ALL USING (true);
