#!/usr/bin/env bash
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

echo "=== Radar / Scholarship Accuracy Audit ==="
echo "branch: $(git branch --show-current)"
echo "commit: $(git rev-parse --short=7 HEAD)"
echo

bash scripts/verify.sh

echo
echo "=== Activity live-source check (no apply) ==="
python3 -m py_compile \
  tools/autofetch/autofetch.py \
  tools/autofetch/lifecycle_archive.py \
  tools/autofetch/public_source_registry_bridge.py

python3 tools/autofetch/autofetch.py --check --limit 30

echo
echo "=== Scholarship live-source check (no apply) ==="
python3 -m py_compile \
  tools/autofetch/scholarship_autofetch.py \
  tools/autofetch/lifecycle_archive.py

python3 tools/autofetch/scholarship_autofetch.py --repo . --check

echo
echo "=== Production data must remain unchanged ==="
git diff --exit-code -- \
  data/activities.json \
  data/scholarships.json \
  data/activity-archive.json \
  data/scholarship-archive.json

echo
echo "OK: radar and scholarship audit completed without changing production data"
