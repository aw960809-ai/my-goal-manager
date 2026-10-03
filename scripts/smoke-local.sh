#!/usr/bin/env bash
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

PORT="${1:-8080}"

echo "Goal Manager local smoke test"
echo "Branch: $(git branch --show-current)"
echo "Commit: $(git rev-parse --short=7 HEAD)"
echo
echo "手機瀏覽器請開："
echo "  http://127.0.0.1:${PORT}/"
echo
echo "驗收順序："
echo "  1. 首頁"
echo "  2. 目標：逐層瀏覽 / 完整地圖 / 搜尋"
echo "  3. 執行：選取任務 / 開始 / 暫停 / 完成"
echo "  4. 其他讀書：補登與計時"
echo "  5. 分析：目標讀書 / 其他讀書 / 總讀書"
echo "  6. 行事曆"
echo "  7. 重新整理後確認資料與計時狀態"
echo
echo "Ctrl+C 可停止伺服器。"
echo

python3 -m http.server "$PORT" --bind 127.0.0.1
