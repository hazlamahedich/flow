# AGENTS.md

## What this repo is

A **BMAD-driven planning and design workspace** for Flow OS (VA productivity SaaS with 6 AI agents). No application code exists yet — all 10 epics are in `backlog`. The repo contains specs, architecture decisions, and AI tool configuration only.

## Key paths

| Path | Purpose |
|---|---|
| `docs/project-context.md` | Canonical technical rules (180 rules, 7 sections). Read this before any implementation work. |
| `_bmad-output/planning-artifacts/` | PRD, architecture, UX spec, epics, agent specs. Source of truth for requirements. |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | Sprint tracking (file-based). Story status lives here. |
| `files/` | Reference documents (PRD v2.0 docx, engineering plan, user flows, agent mesh spec). |

## Workflow

This repo uses **BMAD v6.3.0** methodology. The workflow is sequential:

1. Product Brief → PRD → UX Design → Architecture → Epics → Stories → Dev
2. Steps 1–4 are complete. Epics are defined. Stories have not been created yet.
3. Use BMAD skills (loaded via `.opencode/skills/`) to advance the workflow — don't freehand it.

### BMAD skill naming convention

- `bmad-create-story` — generate next story from epics
- `bmad-dev-story` — implement a story file
- `bmad-sprint-planning` / `bmad-sprint-status` — track progress
- `bmad-check-implementation-readiness` — validate specs before dev
- `bmad-help` — if unsure what to do next

## Multi-tool environment

Multiple AI tool configs coexist and must stay in sync:

- `.opencode/` — OpenCode (primary). Skills + plugin deps.
- `.claude/` — Claude Code. Mirrors BMAD skills.
- `.agent/` — General agent config. Mirrors BMAD skills.
- `.serena/` — Serena MCP. `project.yml` currently set to `python`; should be `typescript` once app code exists.
- `.gemini/`, `.kilocode/`, `.kiro/` — Other tool configs.

When updating BMAD skills or project config, update all three skill directories (`.opencode/skills/`, `.claude/skills/`, `.agent/skills/`).

## Planned tech stack (from project-context.md)

- TypeScript 5.5+ (strict), Node.js 20 LTS, Turborepo monorepo
- Next.js 15 App Router only, React 19 (Server Components by default)
- Supabase (Postgres + Auth + Storage + RLS), Drizzle ORM
- shadcn/ui + Tailwind + Radix, BlockNote editor
- Vercel AI SDK, Groq (fast tasks), Anthropic (quality tasks)
- pg-boss (agent orchestration), Trigger.dev (scheduled jobs/webhooks)
- Vitest + Playwright, MSW for mocking

## Constraints agents are likely to miss

- **No `any`, no `@ts-ignore`, no `@ts-expect-error`** — strict mode with `noUncheckedIndexedArrayAccess` and `exactOptionalPropertyTypes`.
- **App Router only** — no Pages Router patterns anywhere.
- **Server Components by default** — `"use client"` only when needed (event handlers, hooks, browser APIs).
- **RLS is the security perimeter** — `service_role` key only in agent execution and system webhooks, never in user-facing code.
- **`::text` cast required** when comparing `workspace_id` (uuid) against JWT claims (text) in RLS policies — without it, RLS silently denies all queries.
- **Money is integers in cents** — never float. `$10.99` = `1099` in the database.
- **Agent modules are isolated** — `packages/agents/{name}/`, no cross-agent imports. Communication via database records only.
- **Provider abstraction is mandatory** — agent code never imports Gmail/Calendar SDKs directly; goes through `EmailProvider`/`CalendarProvider` interfaces.
- **Supabase client: one per request on server** — use `@supabase/ssr`, never `@supabase/supabase-js` directly in browser.
- **Server Actions colocated with route groups** — not in a shared root `actions/` folder.
- **200 lines per file soft limit** (250 hard). Functions ≤50 lines logic, ≤80 lines components.
- **Named exports only** — default exports only for Next.js page components.
- **No barrel files inside feature folders** — only at package boundaries.

## No build/test/lint commands yet

The application does not exist. Once scaffolding begins, the Turborepo pipeline will be: `build → test → lint`. Packages build before apps. Update this section when the monorepo is created.
