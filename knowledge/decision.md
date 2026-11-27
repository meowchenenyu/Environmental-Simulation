# 待決策事項與建議

記錄需要外部帳號、服務供應商或產品政策才能定案的選擇。先寫出建議和依據，讓不依賴這些選擇的工作可以繼續。

## 2026-11-27：雲端帳號與島嶼同步服務

### 狀態

建議採用 Supabase 作為階段 4 第一版的託管資料庫與登入服務。`cloud-sync.js` 已完成 SDK adapter 和 mock 測試，但尚未建立服務專案或連線，因此尚無實際登入 UI、部署設定或雲端同步。

### 建議

- 目前前端是部署於 GitHub Pages 的純 HTML、CSS 與 JavaScript。第一版保留這種部署方式，以 Supabase Auth 和 Postgres 支援登入及島嶼同步。
- 島嶼名稱、描述、封面圖示、擁有者、建立時間、可見度等管理欄位使用 Postgres 欄位；模擬狀態和快照可先以有版本的 JSONB 文件保存。這讓既有 JSON 匯出格式可沿用，同時讓未來的擁有者查詢、複製和公開探索保留關聯式索引空間。
- 瀏覽器只使用 Supabase publishable key；每張前端可存取的表都啟用 Row Level Security，並限制使用者只能讀寫 `owner_id = auth.uid()` 的資料。不得把 secret key 放進 GitHub Pages、前端程式或匯出檔。
- 初版島嶼預設私人，只收集登入和存檔所需的最少資料。選擇最近的可用亞太服務區域；要開放公開分享時，再定義隱私、檢舉和刪除政策。
- 先以本機／測試專案驗證 schema、RLS 和帳號流程，再接入正式 Pages 網站；上線前重新確認服務費用與備份方式。

### 原因與替代方案

Supabase 將 Auth 與 Postgres 整合，且 RLS 可在資料庫層按每列限制使用者存取，符合島嶼擁有者隔離的需求。Firebase 也是可行替代方案，具備 Authentication 和 Firestore Security Rules；本專案預期需要島嶼擁有者、分享與收藏等關聯資料，因此建議優先採用關聯式 Postgres，而非先採文件式資料庫。

供應商文件：[Supabase Auth 架構](https://supabase.com/docs/guides/auth/architecture)、[Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)、[Supabase API keys 安全說明](https://supabase.com/docs/guides/getting-started/api-keys)、[Firebase Firestore 安全規則](https://firebase.google.com/docs/firestore/security/get-started)。Supabase 文件指出瀏覽器只能使用可公開的 publishable key，資料安全仍須由 RLS 限制；secret key 具有更高權限，不得送到前端。

### 尚待確認的外部條件

- 建立 Supabase 專案並保管專案 URL 和 publishable key；金鑰不寫入版本控制，透過部署環境設定提供。
- 在專案 Auth 設定中加入實際 GitHub Pages 網址作為允許的 redirect URL，並確認 email confirmation 流程。
- 確認最終部署網址、登入方式、服務區域、帳號刪除與資料保留政策。
- 啟動可用的 Supabase CLI/Docker 或測試專案，套用 migration 並先執行兩份 pgTAP RLS 測試；通過後再接登入和同步 UI。
- Supabase 定價與免費方案限制會變動。依 2026-11-27 查閱的官方定價頁，免費方案標示 500 MB 資料庫，且閒置一週後專案會暫停；正式上線前需再次核對目前方案與備份條件：[Supabase 定價](https://supabase.com/pricing)。

在上述設定未備妥前，已完成可在 mock 下驗證的 Auth/CRUD adapter 和按使用者隔離的本機 UUID 對應；實際 UI、金鑰注入、schema 套用和跨帳號 RLS 測試需等外部設定備妥。
