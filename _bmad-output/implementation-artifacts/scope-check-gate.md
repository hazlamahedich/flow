# Scope Check Gate

Mandatory review before story development begins. Applies to all stories from Epic 3 onward.

## Purpose

Prevent mid-sprint story splits by validating scope before implementation starts. Epic 2 had 2 of 8 stories split (2-1, 2-6) because initial scope underestimated integration surface area.

## Checklist

Complete all items before moving story from `ready-for-dev` to `in-progress`.

### 1. File Size Estimation

- [ ] Estimate lines of code for primary implementation file(s)
- [ ] If any file will exceed **200 lines** (soft) or **250 lines** (hard), flag for split
- [ ] If any function will exceed **50 lines** of logic or **80 lines** for components, flag for split

### 2. Integration Surface Area

- [ ] List all external boundaries the story touches (DB, API, UI, packages)
- [ ] Count distinct integration points. If **3+**, consider splitting
- [ ] Identify cross-package dependencies (e.g., schema + provider + RLS)

### 3. Adversarial Review History

- [ ] Review findings count from previous stories in same epic
- [ ] If avg findings > 40 for similar-scope stories, this story is likely under-scoped

### 4. Scope Split Triggers

Split the story if ANY apply:

| Trigger | Example |
|---------|---------|
| Touches schema + interface + implementation | 2-1 (schema + pg-boss wiring) |
| Touches display + ceremony + audit | 2-6 (badges + milestones + audit) |
| Creates 3+ new tables or migrations | Multi-table stories |
| Introduces new provider abstraction | Provider interface + implementation |

### 5. Completeness Sign-Off (Architect)

- [ ] Architect reviews all acceptance criteria against file-size limits (200 soft / 250 hard) and component complexity limits (80 lines)
- [ ] For each AC, confirm: can this ship within constraints without deferring?
- [ ] If any AC would require deferral to meet constraints → split the story before dev starts
- [ ] Count estimated ACs that involve new UI components. If **4+ new components**, consider splitting by UI surface
- [ ] Check for "polish" ACs (tooltips, animations, mobile responsiveness). If present, confirm they're achievable in the same story or move to a follow-up story explicitly

### 6. Sign-off

- **PM (John):** Scope matches epic requirements, no missing acceptance criteria
- **Architect (Winston):** Integration surface area is manageable, no hidden dependencies
- **Developer (Amelia):** Implementation plan fits within file/function limits

## Process

1. Story file created → `status: ready-for-dev`
2. Scope check gate review (PM + Architect + Dev)
3. If pass → `status: in-progress`
4. If fail → split story, create sub-stories, restart gate on each

## History

| Epic | Stories Checked | Splits Caught Pre-Dev | Splits During Dev |
|------|----------------|----------------------|-------------------|
| Epic 2 | 0 (not yet implemented) | 0 | 2 (2-1, 2-6) |
| Epic 3 | 3 | 0 | 0 (but 15+ deferred items accumulated) |
| Epic 3 Retro | Process improvement: added completeness sign-off (step 5) and deferred cap rule | — | — |
