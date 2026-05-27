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

# A2b: Count refinement-deferred AC items ("Acceptable Risk", "Ruling", "Deferred to")
# These are not [Review][Defer] tagged but are still deferred scope
REFINEMENT_DEFERRED=$(grep -cEi '^\s*\*\*AR[0-9]+.*\*\*.*[Dd]eferred|Acceptable Risk.*[Dd]eferred|[Rr]uling.*[Dd]eferred|[Dd]eferred.*[Ff]uture.*[Ss]tory' "$STORY_FILE" || true)

TOTAL_DEFERRED=$((DEFERRED + REFINEMENT_DEFERRED))

if [ "$TOTAL_DEFERRED" -gt 5 ]; then
  # Check for documented Architect+PM exception
  if ! grep -qE '## Deferred Cap Exception|### Deferred Cap Exception' "$STORY_FILE"; then
    echo "BLOCKED [$STORY_NAME]: $TOTAL_DEFERRED deferred items exceed cap of 5."
    echo "  [Review][Defer] items: $DEFERRED"
    echo "  Refinement-deferred AC items: $REFINEMENT_DEFERRED"
    echo "  Add '## Deferred Cap Exception' section with Architect+PM sign-off."
    echo "  Deferred items:"
    grep -n '\[x\] \[Review\]\[Defer\]' "$STORY_FILE" || true
    grep -ni 'Acceptable Risk.*deferred' "$STORY_FILE" || true
    exit 1
  fi
fi

echo "PASS [$STORY_NAME]: Review close-out gate passes."
echo "  Unresolved findings: $UNRESOLVED"
echo "  Deferred items: $DEFERRED (Review[Defer]) + $REFINEMENT_DEFERRED (refinement AC) = $TOTAL_DEFERRED (cap: 5)"
exit 0
