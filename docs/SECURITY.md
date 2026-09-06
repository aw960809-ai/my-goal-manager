# 系統保護邊界｜V96.5

## 已實作
- 本機資料以 envelope + FNV-1a checksum 保存；匯出備份另附 SHA-256（瀏覽器支援 Web Crypto 時），讀寫後驗證完整性。
- 匯入備份限制 2 MB，並驗證 JSON、schema、資料集合數量與既有資料結構。
- 外部 URL 僅接受 `http:` / `https:`，拒絕 `javascript:` 等危險協定。
- 活動／獎學金資料進入本機資料層前經 ID、標題長度與 URL 邊界檢查。
- 保留既有多份備份槽與 IndexedDB mirror；清除快取不會主動刪除目標與歷程。
- Service Worker cache 每版獨立升版，降低新舊資源混用機率。

## 必須理解的限制
GitHub Pages 是靜態前端環境，因此 HTML/CSS/JS 都不是「秘密」。使用者可以查看瀏覽器端程式碼。V96.5 的保護重點是**防止資料毀損、惡意輸入與不安全 URL**，不是隱藏前端原始碼。

任何 API key、token、密碼、私有憑證或敏感個資都不得放入 repository 或前端 JavaScript。

## V96.5 加固
- 導覽事件獨立為 navigation.js，降低 app.js 耦合。
- 匯出備份優先附 SHA-256；匯入時驗證 SHA-256，並保留 FNV-1a 相容。
- 保留現有資料主鍵與 schema，避免升版造成資料遷移風險。

## 未來自動資料更新
活動雷達若接入外部資料，應採：

`外部來源 → GitHub Actions／伺服器端整理 → 驗證 → JSON → GitHub Pages`

不要將需要保密的憑證放在瀏覽器端。
