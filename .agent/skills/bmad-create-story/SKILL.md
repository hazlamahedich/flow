---
name: bmad-create-story
description: 'Creates a dedicated story file with all the context the agent will need to implement it later. Use when the user says "create the next story" or "create story [story identifier]"'
version: 1.1.0
author: Hermes Agent
---

# BMAD Create Story

Creates a self-contained, implementation-ready story file for the BMAD development pipeline.

## When to Use

- User says "create the next story" or "create story [story identifier]"
- A story in `sprint-status.yaml` needs its dedicated `.md` file created
- Before `validate-story` and `dev-story` can run, the story file must exist

## When NOT to Use

- Planning artifacts (PRD, Architecture, Epics) don't exist yet — run planning pipeline first
- The sprint tracker doesn't list the story — add it to `sprint-status.yaml` first

## Story File Location

All story files live at:

```
{project-root}/_bmad-output/implementation-artifacts/stories/{story-key}.md
```

Example: `1-2-authentication-with-phxgenauth.md`

## Step-by-Step Procedure

### 1. Load Context

Read these in order:
1. `sprint-status.yaml` — find the story identifier and status
2. `_bmad-output/planning-artifacts/epics.md` — extract the story definition and ACs
3. `_bmad-output/planning-artifacts/prd.md` — find related FRs
4. `_bmad-output/planning-artifacts/architecture.md` — find ADRs and data model
5. The **previous story's `.md` file** — copy its frontmatter, structure, and Dev Notes sections as a template

### 2. Set Metadata

```yaml
---
story_id: "1.2"
epic: 1
epic_title: Foundation
story_key: 1-2-authentication-with-phxgenauth
status: ready-for-dev
created: 2026-05-24
author: BMad Story Agent
input_documents:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
  - _bmad-output/implementation-artifacts/stories/1-1-phoenix-v18-app-scaffold.md
---
```

- `status` must be `backlog` → `ready-for-dev` upon creation
- `story_key` must match the slug in `sprint-status.yaml` exactly
- `input_documents` must include the **immediately preceding story** as a template reference

### 3. Write Story Header

```markdown
# Story 1.2: Authentication with phx.gen.auth

Status: ready-for-dev

## Story

As a <user type>,
I want <goal>,
so that <benefit>.
```

### 4. Write Acceptance Criteria (ACs)

Number from AC0 upward. Every story must have:

- **AC0 — Test-First**: Define what red-phase tests must exist before implementation, and how many tests must pass after.
- **AC1 — Primary Feature**: The main deliverable, referencing exact commands or behaviors.
- **AC2–ACn**: Supporting criteria covering security, edge cases, error handling, UX.

AC style: Given/When/Then with specific filenames, routes, and field names.

### 5. Pre-Dev Dependency Scan

Copy this checklist verbatim and fill:

```markdown
## Pre‑Dev Dependency Scan

- [ ] Graphify query run — key dependencies listed below
- [ ] Dependencies: <prior story key> is <status> — <specific files/modules> needed
- [ ] UX AC review — Confirmed: <UX spec section> satisfies <UI elements>
- [ ] Architect sign-off: <specific constraint> [Source: architecture.md#section]
```

### 6. Write Tasks / Subtasks

Group into numbered tasks, each with subtask checkboxes:

```markdown
- [ ] **Task 1: Red-phase tests** (AC: #0)
  - [ ] 1.1 Create `test/..._test.exs` covering ...
  - [ ] 1.2 Run `mix test` and confirm all new tests fail (red phase).
- [ ] **Task 2: Generate auth scaffold** (AC: #1)
  - [ ] 2.1 Run `mix ...`
  - [ ] 2.2 Verify `mix compile` succeeds with zero warnings.
```

Every task must reference its AC number in parentheses.

### 7. Write Dev Notes

This is the most critical section for the dev agent. Include:

- **Architecture Constraints & Decisions**: ADR references, pattern choices, Phoenix gotchas
- **Database & Runtime**: Table schemas, field types, index notes, env defaults
- **Project Structure Notes**: Expected file tree after implementation, alignment check, conflict check
- **Testing Standards**: Minimum test count, test categories, generator test preservation rules
- **References**: Links to PRD sections, Architecture sections, previous dev notes

### 8. Update Sprint Tracker

Patch `sprint-status.yaml` to change the story status from `backlog` to `ready-for-dev`.

## Common Pitfalls

1. **Missing `workflow.md`**: This skill is self-contained. Do NOT fail if `./workflow.md` is missing. Use the procedure above directly.
2. **Wrong story status**: Never leave status at `backlog` after creating the file. Always set to `ready-for-dev`.
3. **Omitting previous story reference**: The dev agent needs the prior story's implementation notes (deferred items, debug logs, file changes) to avoid regressions. Always include the preceding story in `input_documents`.
4. **Vague ACs**: ACs must name specific files, routes, database fields, and error messages. "It works" is not an AC.
5. **Skipping Graphify**: Even if no prior code exists, explicitly mark the Graphify checkbox with rationale.
6. **Forgetting scope-check-gate reference**: If >5 deferred items are anticipated, add a note referencing the scope-check-gate step 7 rule.
7. **Stale red-phase scaffold files**: When the adversarial review converts controller tests to LiveView tests (or restructures any test file), the OLD test file must be deleted before green-phase activation. Leaving stale skipped tests causes file duplication and can mask real failures.

## References

- `references/story-template.md` — Full copy-paste template for a Phoenix story file

## Change Log

- 1.1.0 — Self-contained rewrite: removed dependency on `./workflow.md`, added step-by-step procedure, pitfalls, and Phoenix-specific AC style guidance.
- 1.0.0 — Initial skill (delegated to `./workflow.md`).
