# Project Structure Details

## Current State (Pre-Implementation)
The project is in **planning phase**. No application source code exists yet.

### Directory Layout
```
/Volumes/One Touch/flow/
├── _bmad/                      # BMad framework
│   ├── agents/                 # Agent personas (agent-forge, agent-orion)
│   ├── memory/                 # Agent memory/state
│   ├── core/                   # Core BMad tools
│   ├── cis/                    # Creative/innovation skills
│   ├── tea/                    # Test engineering architecture
│   ├── bmm/                    # Module manager
│   └── bmb/                    # Builder
├── _bmad-output/               # Generated artifacts
│   ├── planning-artifacts/     # PRD, architecture, UX, epics, agent specs
│   ├── implementation-artifacts/
│   └── test-artifacts/
├── docs/
│   └── project-context.md      # 509-line AI rules file (180 rules)
├── files/                      # Reference .docx files
│   ├── Flow_OS_PRD_v2.0.docx
│   ├── Flow_OS_Agent_Mesh_Spec.docx
│   ├── Flow_OS_Phase1_Engineering_Plan.docx
│   ├── Flow_OS_User_Flows.docx
│   └── Flow_OS_Agent_Mesh_Spec.docx
└── skills/                     # Installed agent skills
    ├── agent-forge/
    └── agent-orion/
```

### Expected Structure (Post-Implementation)
```
apps/
  web/                   # Next.js 15 app (App Router)
    app/
      (auth)/            # Public auth routes
      (workspace)/       # Authenticated workspace routes
      portal/[slug]/     # Client portal
    e2e/                 # Playwright E2E tests
packages/
  ui/                    # @flow/ui — shared components
  agents/                # @flow/agents — 6 agent modules
    inbox/
    calendar/
    ar-collection/
    weekly-report/
    client-health/
    time-integrity/
  db/                    # @flow/db — Supabase client + types
  validators/            # @flow/validators — Zod schemas
  test-utils/            # @flow/test-utils — shared test infra
supabase/
  migrations/            # Version-controlled migrations
```

### Key Planning Artifacts
- `prd.md` — Product Requirements Document
- `architecture.md` — Technical architecture decisions
- `ux-design-specification.md` — UX patterns and specs
- `epics.md` — Epic and story breakdown
- `inbox-agent-spec.md` — Inbox agent detailed spec
- `calendar-agent-spec.md` — Calendar agent detailed spec
- `trust-graduation-mini-spec.md` — Trust model spec
- `product-brief-flow.md` — Product brief
- `implementation-readiness-report-2026-04-20.md` — Readiness assessment
