# 群島觀察誌

虛擬生態系模擬器的互動式前端原型。使用純 HTML、CSS 與 JavaScript，無需建置步驟，可直接部署到 GitHub Pages。

## 本機預覽

直接以瀏覽器開啟 `index.html`，或使用任意靜態檔案伺服器。

## GitHub Pages 部署

GitHub Actions workflow 位於 `.github/workflows/deploy.yml`。推送到 `main` 或 `master` 後會自動發布；也可以從 Actions 頁面手動執行 `Deploy to GitHub Pages`。

首次設定時，請到 repository 的 **Settings → Pages → Build and deployment**，將來源設為 **GitHub Actions**。部署完成後，Pages 網址會顯示在 workflow 的 deployment environment。

## 專案內容

- `index.html`：繁體中文生態島嶼儀表板。
- `styles.css`：響應式版面與視覺樣式。
- `app.js`：模擬時間控制、物種觀察、圖層切換等原型互動。
- `knowledge/plan.md`：產品願景與開發路線圖。
