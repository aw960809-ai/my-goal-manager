# V98 Refactor Plan

Baseline:
57a4fed / V97.14.0

## Architecture A — Domain Core

GoalDomain 已完成。

接續：
1. StudyLogDomain
2. ExecutionDomain
3. AnalyticsDomain
4. CalendarDomain

驗收：
- Domain 不碰 DOM
- Domain 不碰 storage
- Domain 不依賴 global db
- 單元測試通過
- 舊 wrapper 與新 Domain 輸出一致

## Architecture B — Services

抽離：
- TimerService
- ExecutionService

驗收：
- Timer 可開始、暫停、恢復、結束
- reload 後 active timer 可恢復
- goal-study 與 other-study 行為不變

## Architecture C — Data + UI

Data：
- normalization
- migrations
- repository
- seed

UI：
- goals page
- execution page
- analytics page
- calendar page
- dashboard page

此階段仍不得變更資料 schema。

## Architecture D — Cleanup

確認所有新模組穩定後：

- 移除 legacy wrappers
- 移除重複 helper
- 移除 dead code
- 降低 app.js 體積
- app.js 最終只保留 bootstrap / wiring

## Every Stage Must Pass

1. JavaScript syntax checks
2. Domain unit tests
3. Integration tests
4. qa_static.py
5. git diff --check
6. Mobile smoke test

正式 main 永遠保持可用。
