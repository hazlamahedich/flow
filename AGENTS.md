# AGENTS.md

## What this repo is

A **BMAD-driven planning and design workspace** for Flow OS (VA productivity SaaS with 6 AI agents). Epic 1 (Foundation) is complete — 17 stories implemented across all packages. Epic 2 (Agent Infrastructure & Trust System) is next. The repo contains working application code, specs, architecture decisions, and AI tool configuration.

## Key paths

| Path | Purpose |
|---|---|
| `docs/project-context.md` | Canonical technical rules (180 rules, 7 sections). Read this before any implementation work. |
| `_bmad-output/planning-artifacts/` | PRD, architecture, UX spec, epics, agent specs. Source of truth for requirements. |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | Sprint tracking (file-based). Story status lives here. |
| `apps/web/` | Next.js 15 application (App Router, Server Components, Server Actions). |
| `packages/` | Shared packages: `db`, `types`, `ui`, `shared`, `auth`, `tokens`, `test-utils`. |
| `supabase/migrations/` | Database migrations (22 files). `supabase db reset` to apply all. |
| `supabase/tests/` | pgTAP RLS test suite (9 files, 137 tests). Run via `psql -f` (Docker mount issue with `supabase test db`). |
| `tests/e2e/` | Playwright E2E tests. Global setup verifies seed users exist. |
| `apps/web/__tests__/acceptance/` | ATDD red-phase test scaffolds. TDD red phase — `test.skip()` until feature implemented. |
| `files/` | Reference documents (PRD v2.0 docx, engineering plan, user flows, agent mesh spec). |

## Workflow

This repo uses **BMAD v6.3.0** methodology. The workflow is sequential:

1. Product Brief → PRD → UX Design → Architecture → Epics → Stories → Dev
2. Steps 1–4 are complete. Epics are defined. Epic 1 stories all done. Epic 2 ATDD scaffolds ready.
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

## Graphify Knowledge Graph

A unified knowledge graph of the project exists at `graphify-out/graph.json`. It covers planning artifacts (PRD, architecture, UX, epics), implementation artifacts (stories), code (`apps/web/`, `packages/`), migrations, and tests.

**Before any implementation or planning task:**
1. Check if `graphify-out/graph.json` exists
2. If it does, query it for context relevant to your task:
   - `/graphify query "<your question>"` — broad context
   - `/graphify path "Concept A" "Concept B"` — trace dependencies
   - `/graphify explain "Concept"` — understand a concept and its connections
3. Use graph results alongside standard artifact reads. Do not rely on graph alone.

**After completing any task that changes code or artifacts:**
1. Run `graphify --update` on the changed directory to keep the graph in sync
2. Or rely on the git post-commit hook for code-only changes (AST re-extraction, no LLM cost)

**If the graph doesn't exist**, skip graph steps entirely — never block on it. To rebuild from scratch, run graphify on each key directory in order (note: `--wiki` is not supported in graphify v0.8.17 — use the Obsidian converter script below instead):
```bash
graphify _bmad-output/planning-artifacts/ --mode deep
graphify _bmad-output/implementation-artifacts/ --update
graphify apps/web/ --update && graphify packages/ --update
graphify supabase/migrations/ --update && graphify supabase/tests/ --update && graphify tests/ --update
```

**Obsidian bridge** — graphify emits `graph.json` / `GRAPH_REPORT.md` / `graph.html`; it does not emit a markdown vault. To get a queryable Obsidian second-brain over the same graph, run:
```bash
python3 scripts/graphify-to-obsidian.py
# → writes graphify-out/obsidian-vault/{concepts,files,communities,INDEX.md}
# open that folder in Obsidian: File > Open vault
```
Re-run after every `graphify update`. The vault is `.gitignore`d. Scope: ~192 concept notes, ~5000 source-file notes (capped), ~6900 community MOCs. LLM cost: zero (converter reads existing `graph.json`, no API calls).

**Automated refresh** — the Obsidian vault refreshes itself after every commit and branch switch:
- The graphify `post-commit` and `post-checkout` hooks call `scripts/refresh-obsidian-vault.sh`, which launches `scripts/graphify-to-obsidian.py` **detached in the background** (non-blocking — commits return immediately, converter takes ~70s on exFAT).
- The converter has a built-in mtime guard (skips if vault already newer than `graph.json`) and a lockfile (skips if another refresh is running within the last 10 min).
- Opt out for a single commit: `SKIP_OBSIDIAN_REFRESH=1 git commit ...`
- Manual foreground refresh: `pnpm brain` (or `pnpm brain:force` to bypass the mtime guard).
- Background log: `graphify-out/obsidian-vault.refresh.log`.

The hook additions live **outside** graphify's `# graphify-hook-start`/`# graphify-hook-end` markers, so `graphify hook uninstall` + `graphify hook install` will not clobber them.

**Key queries for BMAD workflows:**
- Requirement traceability: `/graphify path "FR28a" "<code_or_story_node>"`
- Coverage gaps: query for PRD requirement nodes with no outgoing story/code edges
- Impact analysis: `/graphify query "what code does story 2-3 touch?"`
- Sprint quality: query for code nodes with no PRD backing (drift detection)

## Build/test/lint commands

- `pnpm build` — Turborepo build (packages build before apps)
- `pnpm test` — Vitest unit tests (418 passing across all packages)
- `pnpm typecheck` — TypeScript strict mode check (0 errors)
- `pnpm lint` — ESLint (0 errors)
- pgTAP RLS tests: `PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -c "CREATE EXTENSION IF NOT EXISTS pgtap;" && PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f supabase/tests/<file>.sql`
- E2E tests: `pnpm exec playwright test` (requires `supabase start`)
- Docker mount issue: `npx supabase test db` fails on external drive path with spaces — use `psql -f` instead

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)
