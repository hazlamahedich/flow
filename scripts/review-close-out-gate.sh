#!/usr/bin/env bash
# review-close-out-gate.sh
# Enforces that stories cannot transition to 'done' while code review findings
# remain unresolved. Run as: ./scripts/review-close-out-gate.sh <story-file>
#
# Exit codes:
#   0 - Gate passes (story can close)
#   1 - Gate blocked (unresolved findings)
#
# Rules:
#   A1: No `[ ] [Review]` items may remain (decision-needed OR patch)
#   A2: If >5 `[x] [Review][Defer]` items exist, requires documented exception

set -euo pipefail

STORY_FILE="${1:?Usage: $0 <story-file-path>}"

if [ ! -f "$STORY_FILE" ]; then
  echo "ERROR: File not found: $STORY_FILE"
  exit 1
fi

STORY_NAME=$(basename "$STORY_FILE")

# A1: Count unresolved review items ([ ] [Review])
UNRESOLVED=$(grep -cE '^\s*- \[ \] \[Review\]' "$STORY_FILE" || true)

if [ "$UNRESOLVED" -gt 0 ]; then
  echo "BLOCKED [$STORY_NAME]: $UNRESOLVED unresolved [Review] items found."
  echo "  All [ ] [Review] items must be resolved before story can close 'done'."
  echo "  Run: grep -n '\[ \] \[Review\]' $STORY_FILE"
  exit 1
fi

# A2: Count deferred items and check for exception record if >5
DEFERRED=$(grep -cE '^\s*- \[x\] \[Review\]\[Defer\]' "$STORY_FILE" || true)

if [ "$DEFERRED" -gt 5 ]; then
  # Check for documented Architect+PM exception
  if ! grep -qE '## Deferred Cap Exception|### Deferred Cap Exception' "$STORY_FILE"; then
    echo "BLOCKED [$STORY_NAME]: $DEFERRED deferred items exceed cap of 5."
    echo "  Add '## Deferred Cap Exception' section with Architect+PM sign-off."
    echo "  Deferred items:"
    grep -n '\[x\] \[Review\]\[Defer\]' "$STORY_FILE"
    exit 1
  fi
fi

echo "PASS [$STORY_NAME]: Review close-out gate passes."
echo "  Unresolved findings: $UNRESOLVED"
echo "  Deferred items: $DEFERRED (cap: 5)"
exit 0
