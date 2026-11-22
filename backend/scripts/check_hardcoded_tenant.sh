#!/usr/bin/env bash
cd "$(dirname "$0")/.." || exit 1
PATTERN='kids shine|ksis|kandirpar|nazrul avenue|udvash|8801971122084'
if git --no-pager grep -nIiE "$PATTERN" -- backend/app frontend/app frontend/components frontend/lib \
     ':(exclude)*seed*' ':(exclude)*test*' ':(exclude)*.md'; then
  echo "FAIL: hardcoded tenant branding found"; exit 1
fi
echo "OK: no hardcoded tenant branding"
