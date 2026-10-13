# V5 CSS 維護與樣式責任歸屬

本階段**不改變**學習資料、題庫、目標資料、同步授權或 API；只消除可證明被新版覆蓋的樣式，並建立長期 CSS 靜態檢查。

## 樣式檔責任

**Goal Manager**：`tokens.css` 管色彩及字級變數；`base.css`、`app-ui.css` 是歷史基礎樣式；`design-system.css` 是主要全站元件規範；`calendar.css` 專屬日曆；`refinements.css` 專屬局部版面；`mobile-fullbleed.css` 專屬手機滿版；`toeic-embed.css` 專屬跨系統嵌入；`ui-layout-v4.css` 負責七個功能區域的響應式編排。

**TOEIC Trainer**：`style.css` 是原始功能樣式；`layout-v043.css` 是閱讀與訓練元件；`preferences-v0433.css` 是主題與設定中心；`ui-layout-v4.css` 是六個主導航目的地與分析紀錄的整體版面。

## 已經整併的範圍

- Goal Manager：刪去 V96.4.3 舊版手機底部導航的整段中間覆寫，完整保留後來的 V96.4.4 導航規則與舊版跨尺寸回退。
- TOEIC Trainer：刪去設定頁標題的兩條完全被後續相同選擇器覆寫的舊宣告，保留目前的緊湊字體設定。
- 保持月曆七欄、英文閱讀段落、答題按鈕、手機手勢及深淺主題不變。

## 長期防回歸

`tools/css_cascade_audit_v5.py` 完全以 Python 標準函式庫執行，不會存取任何使用者資料。

```bash
python3 tools/css_cascade_audit_v5.py --self-test
python3 tools/css_cascade_audit_v5.py --project PROJECT --check
```

其中 `PROJECT` 在目標系統填 `goal`，在 TOEIC 填 `toeic`。程式檢查 CSS 大括號和註解、所有本機 CSS 引入是否存在、引入順序，以及是否增加 `!important`、同條件重複選擇器和相同宣告。

`docs/css-cascade-baseline-v5.json` 是以整併後程式建立的**已審查基準**；它不是允許任意膨脹的豁免。若確實需要新增樣式，應先人工檢閱差異及 Chrome 實際畫面，再執行以下指令並把基準變化送進 PR：

```bash
python3 tools/css_cascade_audit_v5.py --project PROJECT --write-baseline
```

現有 GitHub V5 Real Browser UI Audit 仍透過隔離 Chromium 執行多寬度、淺／深色、導航與內嵌 TOEIC 檢查。**靜態檢查不能單獨證明像素完全相同，須雙重驗收通過才能合併。**
