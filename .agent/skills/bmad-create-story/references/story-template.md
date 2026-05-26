# Story Template — Phoenix 1.8 / BMAD

Copy this template when creating a new story file, then replace bracketed placeholders.

---

```yaml
---
story_id: "[EPIC.NUMBER]"
epic: [EPIC_NUMBER]
epic_title: [EPIC_TITLE]
story_key: [epic-number-story-slug]
status: ready-for-dev
created: [YYYY-MM-DD]
author: BMad Story Agent
input_documents:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
  - _bmad-output/implementation-artifacts/stories/[PREVIOUS_STORY_KEY].md
---

# Story [ID]: [Title]

Status: ready-for-dev

## Story

As a [user type],
I want [goal],
so that [benefit].

## Acceptance Criteria

0. **[AC0 — Test-First]** Before implementation, write red ExUnit tests for [list scenarios].
   All tests must fail (red) before code changes. After implementation, all tests pass (green).
   AC0 satisfied by `mix test` showing [N]+ tests passing.

1. **[AC1 — Primary Feature]** Given [precondition], when [action], then [expected outcome].
   [Specific filenames, routes, or commands].

2. **[AC2 — Security/Edge Case]** Given [precondition], when [action], then [expected outcome].

3. **[AC3 — Scope/Integration]** Given [precondition], when [action], then [expected outcome].

## Pre‑Dev Dependency Scan

- [ ] Graphify query run — [rationale or key dependencies]
- [ ] Dependencies: [prior story] is [status] — [specific files/modules must exist]
- [ ] UX AC review — Confirmed: [UX spec section] satisfies [UI elements]
- [ ] Architect sign-off: [specific constraint] [Source: architecture.md#section]

## Tasks / Subtasks

- [ ] **Task 1: Red-phase tests** (AC: #0)
  - [ ] 1.1 Create `test/[path]_test.exs` covering [scenarios]
  - [ ] 1.2 Run `mix test` and confirm all new tests fail (red phase).
- [ ] **Task 2: [Primary implementation]** (AC: #1)
  - [ ] 2.1 [Step]
  - [ ] 2.2 Verify `mix compile` succeeds with zero warnings.
- [ ] **Task 3: [Secondary implementation]** (AC: #2)
  - [ ] 3.1 [Step]
- [ ] **Task 4: [Integration verification]** (AC: All)
  - [ ] 4.1 Run `mix test` and confirm all red-phase tests now pass.
  - [ ] 4.2 Run `mix format` and verify no formatting issues.

## Dev Notes

### Architecture Constraints & Decisions

- [ADR or pattern] [Source: architecture.md#section]
- **Phoenix 1.8 `Scope` + `on_mount`** replaces legacy `fetch_current_user` plug.
  `Scope.for_user(nil)` must return `%Scope{user: nil}`, never `nil`.
- **Project module name** is `LeadforgeAi` (auto-camelCase from `leadforge_ai`).
  Do NOT rename to `LeadForge`.
- **Double-namespace bug**: After `phx.gen.*` generation, inspect file paths.
  If `LeadforgeAiWeb.LeadforgeAiWeb.*` appears, rename modules/paths manually.
- **`--no-mailer`**: Use `--no-mailer` for auth scaffolding if email delivery is deferred.

### Database & Runtime

- [Table/field notes] [Source: architecture.md#data-model]
- Timestamps use `timestamptz` (not `:naive_datetime`) for timezone safety;
  `phx.gen.auth` defaults to `:naive_datetime` — handle via migration if needed.

### Project Structure Notes

Expected files after implementation:

```
leadforge_ai/
├── lib/leadforge_ai/
│   └── [context]/
│       └── [files]
├── lib/leadforge_ai_web/
│   └── [controllers|live]/
│       └── [files]
```

- **Alignment:** Matches Phoenix 1.8 generator output.
- **Conflict:** None (or list if applicable).

### Testing Standards

- AC0 minimum: [N] context tests + [N] controller tests + [N] LiveView tests.
- Do not delete Story 1.1's 5 generated tests; they must still pass.
- Dev confirmation tokens: In `:dev`/`:test`, log token via
  `Logger.info("Dev confirmation URL: /users/confirm/#{token}")` so developers
  can copy-paste without SMTP.

### References

- `prd.md` Section [N] [Source: _bmad-output/planning-artifacts/prd.md#section]
- `architecture.md` Section [N] [Source: _bmad-output/planning-artifacts/architecture.md#section]
- `epics.md` Story [ID] definition [Source: _bmad-output/planning-artifacts/epics.md#Story-X.Y]

---

## Dev Agent Record

### Agent Model Used

*(To be filled by dev agent)*

### Debug Log References

*(To be filled by dev agent)*

### Completion Notes List

*(To be filled by dev agent after implementation)*

### Deferred Items (at close)

1. **[Item]** — Story [ID]
2. **[Item]** — Story [ID]

_If >5 deferred items, require Architect + PM approval per scope-check-gate.md step 7._

### Test Commit Record

| Test File | First Red Commit SHA | Date |
|-----------|---------------------|------|
| (pending) | (pending)           |      |

### Files Changed / Added

*(To be filled by dev agent)*

- `lib/...`
- `test/...`

## Post-Dev Code Review

*(To be filled after code-review skill run)*

**Reviewer:** *(pending)*
**Date:** *(pending)*
**Verdict:** *(pending)*

---

*End of Story [ID]*
```
