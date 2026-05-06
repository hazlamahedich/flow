# Flow OS — Prototype

A clickable UI walkthrough of Flow OS, the AI-native operating system for virtual assistants described in the PRD.

This is a **fully-mocked Next.js 15 prototype**. No backend, no database, no API keys, no real LLM calls. Every screen renders from `lib/mock-data.ts`. The point is to feel the product — Morning Brief, Agent Inbox, trust progression, client portal — not to build any of it for real.

## What's in here

| Surface | Path | What it shows |
|---|---|---|
| Morning Brief | `/` | Maya's daily home — stats, top proposals, today's calendar, agent activity, agent mesh status |
| Agent Inbox | `/inbox` | All 6 agents' pending proposals, filterable by agent, with approve/edit/reject + reasoning + trust progression panel. Failed automation runs surface here too (VFR6) |
| Clients | `/clients` | Portfolio grid: health score, MRR, AR, next action, status |
| Client detail | `/clients/[id]` | Per-client view: tasks, invoices, time entries, agent activity timeline |
| Tasks | `/tasks` | Kanban across all clients with agent-created task badges |
| Time | `/time` | Working timer with start/pause/stop + today's entries |
| Invoices | `/invoices` | All invoices with status (paid/sent/overdue/draft) and AR summary |
| **Automations** (V2) | `/automations` | **NL Automation Builder** — type a workflow in plain English, get a working flow. Active automations list with run stats, templates library, tier limits |
| **Automation detail** (V2) | `/automations/[id]` | Visual flow graph (trigger → steps), original NL prompt, execution history, activate/pause |
| Portal preview | `/portal` | What Maya's client sees at `lumen.portal.flow.app` — branded header, outcome dashboard, approvals, Stripe pay button |
| Settings | `/settings` | Workspace + tier comparison (Free / Pro / Agency) with per-workspace pricing story |

## Run it

```bash
cd flow-os-prototype
npm install
npm run dev
```

Then open <http://localhost:3000>.

> Note: `package.json` pins React 19 RC and Next.js 15.0.3 to match the PRD's stated stack. If your Node is < 20, upgrade first.

## Stack

- **Next.js 15** with App Router (server components by default, client components where state is needed)
- **Tailwind CSS** with a custom palette (`flow`, `ink`, agent-specific tones)
- **shadcn-style** hand-rolled primitives in `components/ui/` (Card, Button, Badge, Avatar, Progress) — no Radix dep, easy to extend
- **lucide-react** for icons
- **class-variance-authority** + **tailwind-merge** for variants

## Architecture notes

- All data lives in `lib/mock-data.ts`. Swap this for Supabase queries to wire up the real backend.
- Agent proposals are typed: see `AgentProposal` in `lib/mock-data.ts`. The same shape would come from your `agent_runs` Postgres table.
- Trust levels (`L0` Supervised → `L3` Autonomous) match the PRD's progression model.
- The 6 agents and their tones live in `components/agent-icon.tsx` — single source of truth for agent visual identity.

## V2 Automations (added)

The signature V2 feature from `prd-v2-open-source-infrastructure.md` — the **natural-language Automation Builder** — is in the prototype.

- **Type → flow.** The hero input on `/automations` accepts a plain-English description ("when a client invoice goes overdue, draft a follow-up and Slack me if no reply in 3 days") and renders a generated Activepieces-style flow with trigger + steps. The translator is mocked client-side via keyword matching in `lib/automations.ts` (`generateFlowFromPrompt`); in V1 of V2 you'd swap this for a Vercel AI SDK structured-output call against your LLM.
- **Templates library** — Chase overdue invoices, Auto-resolve calendar conflicts, Weekly digest, Onboarding kickoff, Stalled-client scan, Payment thank-you. One-click install.
- **Visual flow graph** — vertical step chain with trigger card + agent/service step cards. See `components/flow-graph.tsx`.
- **Execution history** — per-automation run log with step traces, durations, and error messages. See the detail page for "Chase overdue invoices automatically" (`/automations/f1`).
- **Failed runs in Agent Inbox** — VFR6 is honored: the inbox includes a failed-Gmail-step proposal with retry context.
- **Tier limits** — Free 3, Pro 20 (you're 5/20), Agency unlimited. Banner at the top of `/automations`.

The V2 stack callout on `/automations` lists the full open-source toolchain (Activepieces, Qdrant, Mem0, LiteLLM, Temporal, Novu, PostHog) — those tools aren't running in the prototype, but the UI is shaped so you can wire them in without redesigning screens.

## What's intentionally not in this prototype

This is a UI walkthrough, so:
- No auth / Supabase wiring
- No real LLM calls (proposals in `agentInbox` are hand-written; NL flow generation is keyword-matched mock translation)
- No real Stripe (Pay button on the portal page just toggles state)
- No realtime collab on Pages (BlockNote / Hocuspocus not included)
- No actual Activepieces/Qdrant/Mem0 — flow definitions are mocked but match the shape Activepieces' REST API would return
- Other V2 surfaces beyond Automations (semantic search, agent memory viewer, Novu notification center, voice transcription, knowledge graph) are not yet in the UI

## Suggested next steps

1. **Swap mock data for Supabase**: replace `lib/mock-data.ts` imports with server-side fetches against tables that match the PRD's data model (`workspaces`, `clients`, `tasks`, `time_entries`, `invoices`, `agent_runs`).
2. **Wire one agent end-to-end**: AR Collection is the highest-ROI starting point — Stripe webhook → invoice goes overdue → pg-boss job → Vercel AI SDK call → proposal row → surfaces in this exact UI.
3. **Add the Pages surface**: drop in BlockNote + Hocuspocus for collaborative client docs (called out as MVP-required in the PRD).
4. **Build the V2 Automation Builder slice**: NL prompt → Activepieces flow JSON → preview before activate. The signature V2 differentiator.

## File tree

```
flow-os-prototype/
  app/
    layout.tsx                  ← root shell + sidebar
    globals.css
    page.tsx                    ← Morning Brief
    inbox/page.tsx              ← Agent Inbox
    clients/page.tsx
    clients/[id]/page.tsx
    tasks/page.tsx
    time/page.tsx
    invoices/page.tsx
    automations/page.tsx        ← V2: NL builder + active list + templates
    automations/[id]/page.tsx   ← V2: flow graph + execution history
    portal/page.tsx
    settings/page.tsx
  components/
    sidebar.tsx
    topbar.tsx
    proposal-card.tsx           ← centerpiece V1 interaction
    agent-icon.tsx              ← agent visual identity
    service-icon.tsx            ← V2: service/integration icons (Gmail, Slack, etc.)
    flow-graph.tsx              ← V2: visual flow renderer
    automation-builder.tsx      ← V2: NL → flow translator UI
    ui/
      button.tsx
      card.tsx
      badge.tsx
      avatar.tsx
      progress.tsx
  lib/
    mock-data.ts                ← V1 mock data (clients, agents, tasks, etc.)
    automations.ts              ← V2 mock data (flows, templates, executions, NL examples)
    utils.ts
  package.json
  tailwind.config.ts
  tsconfig.json
  next.config.mjs
  postcss.config.js
```
