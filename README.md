# 群島觀察誌

虛擬生態系模擬器的互動式前端原型。使用純 HTML、CSS 與 JavaScript，無需建置步驟，可直接部署到 GitHub Pages。包含島嶼地形編輯器，以及可推進、觀察和回退的簡化生態系模擬。

## 本機預覽

直接以瀏覽器開啟 `index.html`，或使用任意靜態檔案伺服器。

## GitHub Pages 部署

GitHub Actions workflow 位於 `.github/workflows/deploy.yml`。推送到 `main` 或 `master` 後會自動發布；也可以從 Actions 頁面手動執行 `Deploy to GitHub Pages`。

首次設定時，請到 repository 的 **Settings → Pages → Build and deployment**，將來源設為 **GitHub Actions**。部署完成後，Pages 網址會顯示在 workflow 的 deployment environment。

## 專案內容

- `index.html`：繁體中文生態島嶼儀表板。
- `styles.css`：響應式版面與視覺樣式。
- `app.js`：模擬控制、圖表、事件日誌、地形編輯和本機保存。
- `simulation.js`：物種資料、環境更新、資源供需、族群與簡化棲地遷移規則。
- `save-format.js`：本機及匯出／匯入共用的版本化島嶼存檔建立與驗證規則。
- `knowledge/plan.md`：產品願景與開發路線圖。
- `knowledge/experience.md`：開發經驗、限制與未來可套用範圍。
- `knowledge/decision.md`：待外部服務設定的選擇與建議。
- `supabase/migrations/`：雲端島嶼資料表與擁有者 RLS 的未套用草稿。

在頁面頂端開啟「存檔」，可編輯島嶼名稱、介紹與封面圖示、管理最多 20 座本機島嶼、複製島嶼或從快照建立分支，也可匯出 JSON v2 備份或匯入 v1／v2 存檔。地形、島嶼資料與模擬狀態保存在目前瀏覽器的 localStorage，不會自動同步至其他裝置。Supabase migration 目前只是草稿，尚未連接雲端服務。模擬使用簡化的確定性規則，供互動探索，不作為生態科學預測。

## 存檔格式測試

使用 Node.js 執行 `node --test tests/save-format.test.js`，檢查 JSON envelope、v1 相容匯入與常見無效資料。
