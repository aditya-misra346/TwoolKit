#!/usr/bin/env bash
# Start the Vellum processing API on 127.0.0.1:8000
set -euo pipefail
cd "$(dirname "$0")"
exec .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port "${PORT:-8000}" --proxy-headers --forwarded-allow-ips 127.0.0.1 "$@"
