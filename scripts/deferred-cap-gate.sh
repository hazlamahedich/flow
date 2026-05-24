#!/usr/bin/env bash
# deferred-cap-gate.sh — Enforces the deferred items cap rule (max 5 per story)
# Epic 5 retro A1: No story closes 'done' with >5 deferred items and no exception record
#
# Usage:
#   ./scripts/deferred-cap-gate.sh <story-file>
#   ./scripts/deferred-cap-gate.sh _bmad-output/implementation-artifacts/5-1-*.md
#
# Exit codes:
#   0 — Passes (≤5 deferred, or has documented exception)
#   1 — Fails (>5 deferred with no exception)

set -euo pipefail

STORY_FILE="${1:?Usage: $0 <story-file>}"

if [ ! -f "$STORY_FILE" ]; then
  echo "ERROR: File not found: $STORY_FILE"
  exit 1
fi

STORY_NAME=$(basename "$STORY_FILE")

DEFERRED_COUNT=$(grep -cE '\[Review\]\[Defer\]|DEFER|deferred|Defer' "$STORY_FILE" 2>/dev/null || echo "0")

HAS_EXCEPTION=$(grep -cE 'Exception|exception|DEFERRED_CAP_EXCEPTION|Architect\+PM exception' "$STORY_FILE" 2>/dev/null || echo "0")

CAP=5

echo "=== Deferred Cap Gate: $STORY_NAME ==="
echo "Deferred items found: $DEFERRED_COUNT"
echo "Exception record found: $HAS_EXCEPTION"
echo "Cap limit: $CAP"

if [ "$DEFERRED_COUNT" -le "$CAP" ]; then
  echo "PASS: Within cap ($DEFERRED_COUNT ≤ $CAP)"
  exit 0
fi

if [ "$HAS_EXCEPTION" -gt 0 ]; then
  echo "PASS: Exceeds cap ($DEFERRED_COUNT > $CAP) but has documented Architect+PM exception"
  exit 0
fi

echo "FAIL: Exceeds cap ($DEFERRED_COUNT > $CAP) with no documented exception"
echo "Action: Add a named Architect+PM exception section to the story file"
exit 1
