#!/bin/sh
# refresh-obsidian-vault.sh
# Non-blocking refresh of graphify-out/obsidian-vault/ after graph.json changes.
# Safe to call from git hooks (post-commit, post-checkout) — returns immediately,
# converter runs detached in the background.
#
# Opt out: export SKIP_OBSIDIAN_REFRESH=1

set -e

[ -n "$SKIP_OBSIDIAN_REFRESH" ] && exit 0

ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
cd "$ROOT"

# Missing deps → silent no-op (hook must never fail the git operation).
[ -f scripts/graphify-to-obsidian.py ] || exit 0
command -v python3 >/dev/null 2>&1 || exit 0
[ -f graphify-out/graph.json ] || exit 0

mkdir -p graphify-out
LOG=graphify-out/obsidian-vault.refresh.log

# Detach: detach from stdin/stdout, survive the hook process exiting.
nohup python3 scripts/graphify-to-obsidian.py >>"$LOG" 2>&1 &
disown 2>/dev/null || true

exit 0
