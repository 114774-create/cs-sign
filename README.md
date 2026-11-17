# 青山國小｜校慶簽到系統

React + Vite + Tailwind CSS + Supabase。

- `/` 簽到處管理介面（Staff）
- `/principal` 校長手機查閱介面（Principal）

## 開始使用

1. 在 Supabase 的 SQL Editor 執行 `supabase/schema.sql`（資料表為 `cssign_guests`、`cssign_invitations`，已加前綴以便與其他專案共用）
2. 複製 `.env.example` 為 `.env.local`，填入 Supabase URL 與 anon key
3. 安裝並啟動：

```bash
npm install
npm run dev
```

4. 建置：`npm run build`
