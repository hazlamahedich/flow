# Recurring PRD Creation Defects

## Context
This is a living list of defects that **PRD creation consistently produces** and that validation catches. Created during LeadForge AI PRD validation (2026-05-24). Check these before re-validating any PRD; many are fast to spot and cheap to fix.

## Defect Categories

### 1. Missing Product Scope Section
**Symptom:** No explicit In-Scope / Out-Scope / Deferred list. Stakeholders assume features are planned when they are deferred to v0.2+.
**Fix:** Add a `## Product Scope` section immediately after Overview with three sub-lists:
- **In-Scope:** What the PRD version covers
- **Out-of-Scope:** What is intentionally excluded
- **Deferred to {version}:** What is planned later with version markers

### 2. Missing UX/UI Requirements Section
**Symptom:** Functional requirements describe *what* but not *how it feels* — responsive breakpoints, interaction patterns, WCAG targets, design system token strategy.
**Fix:** Add a `## UX/UI Requirements` section covering:
- Responsive breakpoints (mobile-first or desktop-first)
- Interaction patterns (hover states, loading skeletons, optimistic UI)
- Accessibility target (e.g., WCAG 2.1 AA)
- Design system token approach (semantic vs atomic naming)

### 3. Missing Classification Frontmatter
**Symptom:** PRD YAML frontmatter lacks `classification` block, causing validation tools to guess `projectType` (and sometimes guess wrong).
**Fix:** Add to frontmatter:
```yaml
classification:
  domain: general          # or vertical domain
  projectType: web_app     # web_app | mobile | api | library | game
```

### 4. Implementation Leakage into Functional Requirements
**Symptom:** FRs name specific libraries, gems, CLI commands, or provider names (e.g., `phx.gen.auth`, `Oban`, `Nx.Serving`, `EXGBoost`, `Meilisearch`, `Absinthe`). These are *how*, not *what*.
**Fix:** Replace every library-specific mention with a technology-agnostic description:
- `phx.gen.auth` -> "auth module with session/cookie and password hashing"
- `Oban` -> "background job queue with retries and scheduling"
- `Nx.Serving` -> "real-time model inference endpoint with batching"
- `EXGBoost` -> "gradient boosting classifier for tabular data"
- `Meilisearch` -> "full-text search engine with typo tolerance and faceting"
- `Absinthe` -> "GraphQL schema and query execution layer"

### 5. Broken Persona Numbering
**Symptom:** Inserting new sections (like Product Scope) breaks the sequential numbering of personas. Persona 3 may be labeled "Persona 2" after renumbering.
**Fix:** After any structural edit near the personas section, verify each persona header and its inline references (e.g., `As a [Persona Name]`) use consistent IDs.

### 6. Markdown Table Formatting Artifacts
**Symptom:** Double pipes (`||`) or extra pipe characters in tables cause rendering failures and downstream parsing errors.
**Fix:** Run a visual scan over all tables. Replace `||` with `|` in pipe-delimited rows.

## Pre-Validation Checklist (30 seconds)
Before running the full 13-step validation, verify these six items exist and are clean. Skipping this means steps 1–12 will flag them individually anyway.

| # | Check | Location in PRD |
|---|---|---|
| 1 | Product Scope section exists | After Overview |
| 2 | UX/UI Requirements section exists | Near end, before NFRs |
| 3 | `classification` block in frontmatter | Top YAML block |
| 4 | Zero library names in FRs | Scan all `FR-` sections |
| 5 | Persona IDs are consistent | Personas section |
| 6 | Tables have no `||` artifacts | All `|` tables |

## When Re-Validating After Fixes
Always run the full 13-step validation again after applying fixes. Update the validation report's `validationStatus` to `COMPLETE (re-validated after fixes)`, recalculate the holistic quality rating, and enumerate the fixes in the report body.
