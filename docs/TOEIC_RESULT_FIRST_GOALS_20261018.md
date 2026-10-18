# TOEIC 成果制目標樹｜2026-10-18（採審查分支導入）

## 原則
- 不重建原目標樹；原有 direction / integrated / monthly / action ID、父子關係、日期與歷史分鐘紀錄原樣保留。
- 只有 `g3-2026-{10,11,12}-{review,practice}` 六個第四級具體行動改為成果衡量，其餘文章整合、模考、法律等目標維持時間制度。
- 每週題數目標：10 月題目練習與訂正 20 題、11/12 月 30 題；各月錯題鞏固 15 題。可於 Goal Manager 任務編輯中調整。
- 題目練習採**每週不同題號**計數，同題反覆提交只算一題；錯題鞏固僅計數當次真的**到期且重測**的原始錯題，不把同技能新題當作已複習該原題。到期複習與最終掌握分別呈現。
- 須同時有 Goal Manager 原本安全同步、已入帳學習紀錄（事件 ID 一致）及 TOEIC Trainer 本機 Session 作為證據。人工計時或補登分鐘不構成題數或掌握證據。已刪除、重複事件均不計成果。
- 舊版錯題 Session 沒有到期快照，**不可推測**當時是否為到期複習，會顯示「待補證據」，不自動轉成題數。既有時間仍然保留於歷史及總投入統計。
- `previousTimeProgress` 保存升級當下原分鐘制百分比；新的成果制完成度另行由已驗證結果推算，不將分鐘轉換為題數。未修改其他目標的計時或進度語義。
- 原 TOEIC Trainer V7.4 10分鐘／1天／3天／7天書面錯題機制，與單字 2／4／7／14／30 天間隔不變。

## 資料與安全
- Goal Manager Schema 6、`lawLangGoalSystemV92` 不變；新增 optional task 欄位 `progressMetric`, `weeklyTargetCount`, `previousTimeProgress`。
- TOEIC Trainer Schema 1、原 Session ID／資料鍵不變，只在新 Session 增加 `reviewDueIds`, `reviewCorrectIds`, `reviewMasteredIds`（記錄當次交卷時的檢驗證據）。
- 同源且經使用者啟用連動後，Goal Manager 只讀取訓練端資料；訓練端從不直接改寫 Goal Manager 的資料庫。既有 consent、完整性、多分頁寫入防護、重複時間區間及碰撞阻擋均保留。
- 原系統沒有已證實的歷史成果時，畫面以 0 / 待證據顯示，不捏造掌握率。
- 本變更提交至 GitHub PR 供人工／CI 先驗收，不自動合併或部署。
