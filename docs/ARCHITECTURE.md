# Goal Manager Architecture

## 1. 目標

Goal Manager 採用分層架構，避免 UI、資料保存、業務規則與統計運算互相耦合。

資料流：

User
→ UI
→ Application / Service
→ Domain
→ Repository
→ Storage

資料回傳：

Storage
→ Repository
→ Domain
→ Application
→ UI

## 2. Layer Responsibilities

### core
共用且不屬於特定功能的基礎工具。

例如：
- 日期工具
- runtime profile
- data boundary

### domain
純業務規則與計算。

Domain 必須：
- 不讀 DOM
- 不寫 DOM
- 不直接存取 localStorage
- 不直接使用全域 db
- 相同輸入產生相同輸出

預定模組：
- goals.js
- study-logs.js
- execution.js
- analytics.js
- calendar.js

### services
負責具有流程或狀態的操作。

例如：
- Timer
- Execution orchestration

Service 可以協調 Domain，但不得把畫面 rendering 混入業務運算。

### data
唯一負責：
- normalize
- migration
- repository
- seed
- persistence

資料格式重構與程式架構重構分開進行。

### ui
只負責顯示與使用者操作。

例如：
- goals-page
- execution-page
- analytics-page
- calendar-page
- dashboard-page

UI 不重新實作 Domain 已存在的計算規則。

### app.js
最終只負責：
- bootstrap
- state wiring
- navigation
- modules orchestration

## 3. Dependency Rule

允許：

UI
→ Services
→ Domain

Data
→ Domain data input

禁止：

Domain
→ UI

Domain
→ localStorage

Domain
→ global db

Domain
→ document / window UI state

## 4. Single Source of Truth

每一項業務規則只能存在一個正式計算來源。

例如：
- 目標階層：GoalDomain
- 讀書紀錄分類：StudyLogDomain
- 每週執行：ExecutionDomain
- 分析統計：AnalyticsDomain

Dashboard、執行頁與分析頁不得各自重算同一規則。

## 5. Current Business Invariants

### Goal hierarchy
Level 1 → 方向
Level 2 → 階段目標
Level 3 → 子任務
Level 4 → 具體行動

Level 3 保存期間。
Level 4 保存 weeklyMinutes。

### Study logs
goal-study：
計入總讀書時間，且可推進目標執行。

other-study：
計入總讀書時間，但不得推進 Level 4 目標完成度。

system：
不計入實際讀書時間，也不得推進目標。

### Archived data
已封存項目不得進入一般進度與執行統計。

## 6. Refactor Rule

重構期間優先採 Compatibility Wrapper。

舊呼叫：

logDate(...)

先保留名稱，只將內部改成：

StudyLogDomain.logDate(...)

待所有使用點穩定並通過測試後，再移除 wrapper。

## 7. Persistence Safety

在 Data Layer 正式重構以前：

- KEY 不變
- BACKUP_KEYS 不變
- schemaVersion 不變
- 現有 localStorage shape 不變
- 現有 IndexedDB mirror 不變
- migration 行為不變

原則：

搬程式，不搬資料。
