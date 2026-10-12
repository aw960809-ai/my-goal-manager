#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if command -v python >/dev/null 2>&1; then PYTHON=python;
elif command -v python3 >/dev/null 2>&1; then PYTHON=python3;
else echo 'Termux 未安裝 Python；請先執行 pkg install python。' >&2; exit 1; fi
PORT="${1:-8766}"
case "$PORT" in *[!0-9]*|'') echo '連接埠請填 1024–65535 的數字' >&2; exit 1;; esac
if [ "$PORT" -lt 1024 ] || [ "$PORT" -gt 65535 ]; then echo '連接埠請填 1024–65535'; exit 1; fi
if "$PYTHON" - "$PORT" <<'PYCODE'
import socket,sys
with socket.socket() as s:
    s.settimeout(.5)
    status=s.connect_ex(('127.0.0.1',int(sys.argv[1])))==0
sys.exit(0 if status else 1)
PYCODE
then
  echo "連接埠 $PORT 已被使用。若是舊版 TOEIC Trainer 伺服器，直接重新整理 http://127.0.0.1:$PORT/ 即可讀取升級後檔案。"
  echo "若該埠屬於其他程式，可執行 bash START_TERMUX.sh 8767。"
  exit 0
fi
echo "TOEIC Trainer v0.4.2 · 請在手機瀏覽器開啟 http://127.0.0.1:$PORT/"
echo '僅監聽本機；不會修改 Goal Manager 或其他應用程式。'
exec "$PYTHON" -m http.server "$PORT" --bind 127.0.0.1
