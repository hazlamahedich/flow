# Fast-Track Regeneration of Epics.md

## When to Use This Mode

- User says "regenerate", "replace", "rebuild", "update to standards"
- User selects regenerate AND validate together (e.g. "1 and 2")
- Existing `epics.md` has good story content but lacks BMAD-standard template structure
- Missing frontmatter `stepsCompleted`, `inputDocuments`, Requirements Inventory, FR Coverage Map, or Epic Coverage Map
- User's general preference is autonomous action-oriented

## When NOT to Use This Mode

- No existing epics.md exists (use Step 1 interactive)
- Story content is fundamentally bad and needs collaborative redrafting (use standard workflow)

## Workflow

1. **Read all input documents**
   - `{planning_artifacts}/prd.md` (or sharded prd/index.md)
   - `{planning_artifacts}/architecture.md`
   - `{planning_artifacts}/ux-design-specification.md` (if exists)

2. **Read existing epics.md if it exists**
   - Preserve story body content where it is complete and correct
   - Note what is missing from template structure
   - Typical missing pieces:
     - Proper frontmatter with `inputDocuments: [...]`
     - Requirements Inventory section (FRs, NFRs, Architecture reqs, UX-DRs)
     - FR Coverage Map (table mapping PRD sections -> epics -> stories)
     - NFR Coverage Map
     - Epic Coverage Map (mapping individual FR sub-requirements -> stories)

3. **Build new artifact in code**
   - Start with frontmatter and Overview
   - Extract requirements from all input docs programmatically (regex over the markdown)
   - Assemble the Requirements Inventory with 4 sub-sections
   - Build FR/NFR Coverage Maps as tables
   - Insert the preserved Epic List and Epic sections
   - Append the Epic Coverage Map

4. **Validate against Step 4 criteria**
   - Has frontmatter with `inputDocuments`
   - Has Requirements Inventory (FR, NFR, Additional, UX-DR)
   - Has FR Coverage Map
   - Has Epic List (table or list)
   - Has 5 Epic sections with story format
   - Has Epic Coverage Map
   - Acceptance criteria follow Given/When/Then format
   - Stories within each epic have forward-dependency discipline (Story N.M only depends on N.1 through N.(M-1), never on future stories within same epic)
   - Epics are independent deliverable units (Epic 2 does not require Epic 3 to function)

5. **Write to `{planning_artifacts}/epics.md`**
   - Overwrite existing file
   - Report validation results

## Pitfalls

- **Do not create all database tables upfront** (Story 1.1 should only create what it needs)
- **Do not write stories with forward dependencies** within the same epic
- **Do not organize epics by technical layer** (Database, API, Frontend) — organize by user value
- **Given/When/Then format**: Accept plain `Given`/`When`/`Then` keywords in acceptance criteria. The BMAD template allows both bold `**Given**` and plain formats. Do not reject a file for using plain keywords.
- Architecture document may specify a starter template (e.g. Phoenix scaffold). Mark Story 1.1 accordingly so the dev agent knows the starting point.

## Validation Checklist

| Check | Description |
|---|---|
| Frontmatter | `---\ninputDocuments: [...]\n---` present |
| Overview | Section with project name |
| Requirements Inventory | FR, NFR, Additional (Architecture), UX Design Requirements |
| FR Coverage Map | Table mapping PRD sections -> Epic # -> Stories |
| Epic List | Table listing epics, descriptions, target phases |
| Epic Sections | 1+ sections, each with goal statement and stories |
| Story Format | Numbered `### Story N.M: Title`, user story, acceptance criteria |
| AC Format | Given/When/Then with specific outcomes |
| Epic Coverage Map | Table mapping individual FRs -> stories |
| No fwd deps | Story N.M only depends on prior stories in same epic |
| Epic independence | Epic 2 works without Epic 3 being done |
