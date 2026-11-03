#!/usr/bin/env bash
# Vellum Auto-Commit & Push Watcher
# Automatically detects new file changes, commits them, and pushes to GitHub
# so that Vercel auto-deploys immediately.

set -euo pipefail
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

INTERVAL="${1:-10}" # seconds between checks

echo "🚀 Vellum auto-commit daemon active for: $PROJECT_DIR"
echo "⏰ Checking for changes every $INTERVAL seconds..."

while true; do
  # Check if there are modified, added, or deleted files
  if [[ -n "$(git status --porcelain)" ]]; then
    CHANGES_COUNT=$(git status --porcelain | wc -l | tr -d ' ')
    TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")
    echo "[$TIMESTAMP] Detected $CHANGES_COUNT changed file(s). Staging and committing..."

    git add -A
    git commit -m "Auto-update: $TIMESTAMP ($CHANGES_COUNT file(s) modified)"

    echo "[$TIMESTAMP] Pushing changes to GitHub (origin/main)..."
    git push origin main
    echo "[$TIMESTAMP] ✅ Pushed to GitHub! Vercel auto-deployment triggered."
  fi
  sleep "$INTERVAL"
done
