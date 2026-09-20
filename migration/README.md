# Unified GitHub Migration

正式 main 在驗證前不直接覆蓋。

## 目標
- `/`：THU Goal Manager
- `/toeic/`：News x TOEIC
- `/ledger/`：六類懶人記帳

## 資料安全
1. 現有 AppDeploy 不先刪除。
2. GitHub main 不先切換。
3. TOEIC 與 Ledger 先匯出完整 migration JSON。
4. GitHub 版匯入後，比對筆數、分鐘、錯題、模考、交易金額與生活費拆分。
5. 比對通過才合併 main。

## 匯入檔暫存
將 AppDeploy 匯出的 JSON 放進 `migration/incoming/` 前，先保留手機 Downloads 原檔。
個人備份 JSON 不應 commit 到 public repository。
