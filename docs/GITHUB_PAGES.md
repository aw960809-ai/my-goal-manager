# GitHub Pages 生產化部署

本專案採 GitHub Pages + GitHub Actions 部署。正式網站入口為 `index.html`，所有網站資源使用相對路徑，支援 repository project site。

## 1. 建立 Repository

建議 Repository 使用：

`personal-goal-system`

將本專案根目錄內容直接放在 repository 根目錄。

## 2. 推送到 `main`

```bash
git init
git add .
git commit -m "V96.3.4 settings, diagnostics and integrity + GitHub Pages"
git branch -M main
git remote add origin <YOUR_REPOSITORY_URL>
git push -u origin main
```

不要把 API key、密碼、個資或其他秘密放入 repository。

## 3. 啟用 GitHub Pages

GitHub → Repository → Settings → Pages → Build and deployment → Source 選擇 **GitHub Actions**。

本專案已內建 `.github/workflows/pages.yml`，push 到 `main` 後會：

1. 執行 `qa_static.py`
2. 組裝 `_site`
3. 上傳 Pages artifact
4. 部署到 GitHub Pages

## 4. 網站位置

如果 Repository 是一般 project site，網址通常為：

`https://<帳號>.github.io/<repository>/`

程式不應寫死 `/css/...`、`/js/...`、`/data/...` 等 root 絕對路徑；本專案已使用 `./` 相對路徑。

## 5. PWA / Service Worker

`manifest.webmanifest`、`sw.js`、`404.html` 均已納入正式部署。Service Worker 使用相對路徑註冊，避免 project site 子路徑造成 scope 錯誤。

## 6. 資料安全

GitHub Pages 是靜態網站。使用者自己的目標、執行紀錄與本機設定仍保存在瀏覽器端，不會因部署而寫入 GitHub repository。

公開 `data/` 只放可公開的活動／獎學金目錄資料。

## 7. 部署後驗收

至少確認：

- 首頁可以載入
- 七個模組可以切換
- 活動雷達與獎學金資料可以載入
- PWA manifest 可讀取
- Service Worker 成功註冊
- `404.html` 可回首頁
- 手機 Chrome 開啟正常
- GitHub Actions 的 Static QA 通過
