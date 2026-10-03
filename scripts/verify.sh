#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

echo
echo "=== Goal Manager verification ==="

echo "[1/5] JavaScript syntax"

while IFS= read -r file; do
  node --check "$file"
done < <(
  find js config -type f -name '*.js' | sort
)

node --check sw.js

echo "[2/5] Unit + integration tests"

TEST_COUNT=0

while IFS= read -r file; do
  echo "  -> $file"
  node "$file"
  TEST_COUNT=$((TEST_COUNT + 1))
done < <(
  find tests -type f -name '*.test.js' | sort
)

if [ "$TEST_COUNT" -eq 0 ]; then
  echo "ERROR: no tests found"
  exit 1
fi

echo "[3/5] Static QA"
python3 qa_static.py

echo "[4/5] Git whitespace check"
git diff --check

echo "[5/5] Architecture foundation"

test -f docs/ARCHITECTURE.md
test -f docs/REFACTOR_PLAN.md
test -f tests/fixtures/canonical-db.js

echo
echo "OK: all verification checks passed"
