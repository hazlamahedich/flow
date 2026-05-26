---
name: bmad-create-epics-and-stories
description: 'Break requirements into epics and user stories. Use when the user says "create the epics and stories list"'
---

Follow the instructions in `./workflow.md`.

## Modes of Operation

### Standard Mode (Interactive Facilitation)
Follow `./workflow.md` step-by-step, halting at each menu for user input. This is the default mode for first-time epic creation.

### Fast-Track Regeneration Mode (Autonomous Batch)
When the user asks to **regenerate** or **replace** an existing `epics.md` that already has good story content but lacks BMAD-standard template structure (e.g. missing Requirements Inventory, FR Coverage Map, epic coverage table, or frontmatter), use the approach in `references/fast-track-regeneration.md`. This mode skips the per-step user pauses, iterates through all 4 workflow steps internally, validates, and writes the final artifact in one pass. Use this when the user selects "1 and 2" (regenerate + validate) or signals autonomous execution preference.

**Trigger signals:**
- User says "regenerate", "replace", "rebuild", "update to standards"
- User selects regenerate AND validate together (e.g. "1 and 2")
- Existing epics.md exists and has story content but no frontmatter `stepsCompleted` or `inputDocuments`
- User's general preference is autonomous action-oriented (skip interactive pauses)
