#!/usr/bin/env bash
# Prepare a clean and up-to-date UI branch. Personal browser data is untouched.
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
if [[ -n "$(git status --porcelain --untracked-files=normal)" ]]; then
  echo '⛔ 工作目錄已有變更；為避免覆蓋內容，請先處理後再建立新分支。'
  git status --short
  exit 1
fi
URL="$(git remote get-url origin)"
case "$URL" in
  https://github.com/aw960809-ai/my-goal-manager.git|https://github.com/aw960809-ai/my-goal-manager|git@github.com:aw960809-ai/my-goal-manager.git) ;;
  *) echo "⛔ origin 非指定儲存庫：$URL"; exit 1;;
esac

git fetch origin main
BASE="$(git rev-parse refs/remotes/origin/main)"
BRANCH="auto/ui-$(date +%Y%m%d-%H%M%S)"
git switch -c "$BRANCH" "$BASE"
echo "✅ 已建立介面安全分支：$BRANCH"
echo '可以套用 UI 修補，完成後執行 bash scripts/automation/submit-ui-pr.sh "修改標題"'
