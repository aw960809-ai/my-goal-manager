# Goal Manager: 安全介面修改自動合併（一次性設定）

## 目的與實際限制

本系統採「PR 測試通過才合併」而非直接修改 main。

- 允許自動合併的檔案：`css/**.css`、`js/ui/pages/*.js`、`js/navigation.js`、`js/ui-feedback.js`、`tests/ui/**/*.test.js`、`docs/**/*.md`、`assets/**/*.{svg,png,webp}`、`README.md`。
- **禁止自動合併**：`js/app.js`、`js/domain`、`js/data`、`js/services`、`config`、`index.html`、`sw.js`、`data`、`.github/workflows`、測試核心契約與其他未列入白名單的檔案。
- 其他條件：PR 為原儲存庫擁有者建立、不是 fork、不是草稿、目標 `main`、分支 `auto/ui-*`、明確帶有 `safe-auto-merge` 標籤，並且沒有衝突、不是過期分支。
- 只接受新增或修改、最多 25 個檔案／600 行異動。遇到刪除、重新命名、規模過大或不在白名單內的檔案，要求人工審查。
- 使用 GitHub `Goal Manager PR Safety Check`（執行完整 `bash scripts/verify.sh`）檢查最新提交；失敗不合併。
- 具有寫入權限的 workflow 只讀取 **main** 上的策略程式，絕不從 PR 分支執行程式；處理成功的同儲存庫 PR 後才合併。
- GitHub Actions 使用 `GITHUB_TOKEN` 合併後，推送事件不會再次觸發工作流程，因此會明確 `workflow_dispatch` 啟動 `pages.yml` 部署。
- **個人資料保存在你的瀏覽器，GitHub 程式修改不會匯入、清空或覆蓋個人紀錄**。但使用時仍應留意應用程式自身儲存邏輯，這個合併門檻不能取代所有安全審核。
- 純 UI CSS/JS 採 Service Worker `networkFirst`，無需為每次小幅樣式修改修改核心版本號。若需要新版號、調整 `index.html` 或核心程式，走人工審查 PR。

## 建置後平常使用方式

第一次在 Termux 執行 `gh auth login --hostname github.com --web`（只在手機登入，不要把任何驗證碼或 token 提供給聊天）。

1. 在 Termux 的儲存庫中：`bash scripts/automation/start-ui-change.sh`。
2. 套用已測試的介面修補。未處理修改時，不會自動推送。
3. 執行：`bash scripts/automation/submit-ui-pr.sh "這次介面修改名稱"`。
4. 這個命令會執行全站測試、推送、建立具有標籤的 PR。遠端 CI 再次通過後，工作流程會自動合併並觸發 GitHub Pages 正式部署。

> ChatGPT GitHub 連線目前讀取成功，但建立分支／PR 回傳 403。這套流程可以消除**低風險 PR 的手動合併**，但在 GitHub 連線授權恢復前，程式更新仍需從已認證的 Termux 上傳。不要在聊天公開憑證或令牌。

## 高風險修改與例外處理

若涉及個人資料、歷史紀錄、統計、計時、資料保存、Schema、PWA 或 GitHub workflow，請建立一般 PR，交叉檢查後人工合併。不要用改名或改標籤繞過高風險規則。

若 CI 失敗，進入 `Actions` 查看 `Goal Manager PR Safety Check`；如果合併後 Pages 部署失敗，手動執行 GitHub Actions `Deploy to GitHub Pages` → `Run workflow`，**勿清除瀏覽器網站資料**。

## 啟用方式

使用隨附 `install_in_termux.sh`，它會檢查遠端專案與版本、建立安全基準、僅在獨立安裝分支加入自動化檔案、執行既有完整測試，推送安裝 PR。因這是更動 GitHub 工作流程與合併權限，首次安裝 PR 仍必須人工確認合併。合併後才能使用自動流程。

<!-- Auto-merge smoke test: 2026-10-08 -->
