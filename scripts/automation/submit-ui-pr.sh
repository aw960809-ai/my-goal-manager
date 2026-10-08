#!/usr/bin/env bash
# Submit a tested, explicitly allowlisted UI-only branch for GitHub auto-merge.
# Never pushes to main; never merges locally; never reads personal browser data.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
TITLE="${1:-}"
if [[ -z "$TITLE" || "$TITLE" == *$'\n'* ]]; then
  echo '用法：bash scripts/automation/submit-ui-pr.sh "介面修改標題"'
  exit 2
fi

BRANCH="$(git branch --show-current)"
if [[ ! "$BRANCH" =~ ^auto/ui-[a-zA-Z0-9][a-zA-Z0-9._-]*$ ]]; then
  echo "⛔ 目前分支不是 auto/ui-*：$BRANCH。請先建立安全 UI 分支。"
  exit 1
fi

for tool in git gh node bash; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "⛔ 找不到 $tool。Termux 可安裝：pkg install git gh nodejs -y"
    exit 1
  fi
done

EXPECTED='https://github.com/aw960809-ai/my-goal-manager.git'
URL="$(git remote get-url origin)"
case "$URL" in
  "$EXPECTED"|https://github.com/aw960809-ai/my-goal-manager|git@github.com:aw960809-ai/my-goal-manager.git) ;;
  *) echo "⛔ origin 不是指定專案：$URL"; exit 1;;
esac

gh auth status --hostname github.com >/dev/null 2>&1 || {
  echo '⛔ GitHub CLI 尚未登入。請先在手機執行 gh auth login --hostname github.com --web。'
  exit 1
}

git fetch origin main
# Reject stale branches: tests must be against current main, not an older release.
if [[ "$(git merge-base HEAD refs/remotes/origin/main)" != "$(git rev-parse refs/remotes/origin/main)" ]]; then
  echo '⛔ 此分支不是基於最新 main。請重新更新分支後測試，避免覆蓋後續修復。'
  exit 1
fi

mapfile -d '' CHANGED < <(git diff --name-only -z HEAD)
mapfile -d '' UNTRACKED < <(git ls-files --others --exclude-standard -z)
CHANGED+=("${UNTRACKED[@]}")
if (( ${#CHANGED[@]} == 0 )); then
  echo '⛔ 找不到未提交的修改；請確認是否已先套用介面修補。'
  exit 1
fi

# Use the same deny-by-default path allowlist as the privileged GitHub workflow.
for file in "${CHANGED[@]}"; do
  UI_FILE="$file" node -e 'if(!require("./scripts/automation/safe-ui-policy.cjs").safePath(process.env.UI_FILE)){console.error("⛔ 非低風險檔案，需要人工 PR 審查：",process.env.UI_FILE);process.exit(1)}'
  if [[ ! -f "$file" ]]; then
    echo "⛔ 自動合併不允許刪除或重新命名檔案：$file"
    exit 1
  fi
done

# Already-staged files are included by git diff HEAD above.
git add -- "${CHANGED[@]}"
git diff --cached --check
bash scripts/verify.sh

# The PR workflow will re-run all checks in GitHub; no local test bypass.
git commit -m "ui: $TITLE"
git push -u origin "$BRANCH"

if ! gh api repos/aw960809-ai/my-goal-manager/labels/safe-auto-merge >/dev/null 2>&1; then
  echo '⛔ GitHub 尚未建立 safe-auto-merge 標籤。已推送分支，但不會自動合併。'
  exit 1
fi

if gh pr view "$BRANCH" --repo aw960809-ai/my-goal-manager --json url >/dev/null 2>&1; then
  echo 'ℹ️ 此分支已有 PR；若已推送更新，GitHub CI 將重新驗證。'
  gh pr view "$BRANCH" --repo aw960809-ai/my-goal-manager --json url --jq .url
else
  gh pr create --repo aw960809-ai/my-goal-manager \
    --base main --head "$BRANCH" \
    --title "ui: $TITLE" \
    --body $'安全介面更新。\n\n- 僅修改白名單允許的 UI / 測試檔案。\n- 本機 `bash scripts/verify.sh` 通過。\n- GitHub CI 再次驗證通過才可自動合併。\n- 個人資料、目標與歷史紀錄未修改。\n\nOpt-in: safe-auto-merge' \
    --label safe-auto-merge
fi

echo
echo '✅ 已推送安全介面 PR。待 GitHub CI 通過後將自動合併，並啟動 Pages 部署。'
echo '⚠️ 若 CI 失敗、分支落後或觸及敏感檔案，會停止自動合併。'
