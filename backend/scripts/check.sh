#!/usr/bin/env bash
# backend/scripts/check.sh : bash scripts/check.sh   (je kono folder theke)
cd "$(dirname "$0")/.." || exit 1
fail=0
step() { printf '\n== %s\n' "$1"; }

PYTHON_BIN="python"
if [ -f "../venv/bin/python" ]; then
    PYTHON_BIN="../venv/bin/python"
elif [ -f "./venv/bin/python" ]; then
    PYTHON_BIN="./venv/bin/python"
elif command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN="python3"
fi

step "1/5 syntax"
$PYTHON_BIN -m compileall -q app scripts || fail=1

step "2/5 undefined names / syntax (ruff)"
RUFF_BIN=""
if [ -f "../venv/bin/ruff" ]; then
    RUFF_BIN="../venv/bin/ruff"
elif [ -f "./venv/bin/ruff" ]; then
    RUFF_BIN="./venv/bin/ruff"
elif command -v ruff >/dev/null 2>&1; then
    RUFF_BIN="ruff"
fi
if [ -n "$RUFF_BIN" ]; then
    $RUFF_BIN check app scripts --select E9,F63,F7,F82 --no-cache || fail=1
else
    echo "ERROR: ruff binary not found in venv or PATH; static check cannot pass."
    fail=1
fi

step "3/5 import app.main (shob router load hoy?)"
$PYTHON_BIN -c "import app.main" || fail=1

step "4/5 DB schema drift"
if [ -n "${SKIP_DB:-}" ]; then echo "skipped (SKIP_DB=1)"; else $PYTHON_BIN scripts/schema_drift.py || fail=1; fi

step "5/5 frontend types"
if [ -n "${SKIP_FRONTEND:-}" ]; then echo "skipped (SKIP_FRONTEND=1)"; else (cd ../frontend && npx tsc --noEmit) || fail=1; fi

if [ "$fail" -eq 0 ]; then echo; echo "ALL OK"; else echo; echo "CHECK FAILED"; exit 1; fi
