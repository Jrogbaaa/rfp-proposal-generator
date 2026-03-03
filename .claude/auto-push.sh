#!/usr/bin/env bash
# Auto-commit and push any uncommitted changes after a Claude session.
# Runs as a Claude Code Stop hook.

REPO_DIR="/Users/JackEllis/RFP BUILD!"

cd "$REPO_DIR" || exit 0

# Only proceed if there are uncommitted changes
if git diff --quiet HEAD 2>/dev/null && git diff --cached --quiet 2>/dev/null; then
  exit 0
fi

# Stage all tracked modifications + new files under src/, docs/, directives/, .claude/
git add src/ docs/ directives/ .claude/ 2>/dev/null

# Nothing staged? Exit cleanly
if git diff --cached --quiet; then
  exit 0
fi

DATE=$(date +%Y-%m-%d)
git commit -m "docs: auto-document session changes ${DATE}

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"

git push origin main
