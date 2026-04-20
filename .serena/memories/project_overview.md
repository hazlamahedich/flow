# Flow OS — Project Overview

## Purpose
Flow OS is a VA (Virtual Assistant) operating system — an AI-powered platform that automates inbox management, calendar scheduling, AR collections, weekly reporting, client health monitoring, and time integrity for virtual assistants. It uses a trust-graduation model where agents progressively earn autonomy.

## Status
**Pre-implementation** — Planning phase complete. All specs (PRD, architecture, UX, epics) finalized. No application source code yet.

## Tech Stack
- **Language:** TypeScript 5.5+ (strict mode), Node.js 20 LTS
- **Framework:** Next.js 15 (App Router only), React 19
- **UI:** Tailwind CSS + shadcn/ui + Radix primitives + BlockNote editor
- **Data:** Supabase (Postgres + Auth + Storage + RLS), Drizzle ORM
- **Monorepo:** Turborepo — packages under `packages/`, apps under `apps/`
- **Validation:** Zod (treated as contracts between layers)
- **Agents:** Vercel AI SDK, Groq (fast), Anthropic (quality)
- **Jobs:** pg-boss (agent orchestration), Trigger.dev (scheduled/webhooks)
- **Testing:** Vitest (unit/integration), Playwright (E2E)
- **Integrations:** Stripe, Google OAuth/Gmail/Calendar, Resend

## Monorepo Packages
- `@flow/ui` — shared components
- `@flow/agents` — agent modules (6 agents: Inbox, Calendar, AR Collection, Weekly Report, Client Health, Time Integrity)
- `@flow/db` — database client + types
- `@flow/validators` — Zod schemas
- `@flow/test-utils` — shared test infrastructure

## Key Architecture Decisions
- Server Components by default, `"use client"` only when needed
- Server Actions for mutations, Route Handlers for webhooks only
- Agent modules under `packages/agents/{agent-name}/` — no cross-agent imports
- Multi-tenant isolation via Supabase RLS (security perimeter)
- Provider abstraction for Email and Calendar (never call APIs directly)
- Trust graduation: Supervised → Confirm → Auto

## Project Structure
```
/Volumes/One Touch/flow/
├── _bmad/                    # BMad framework (agents, memory, skills, tools)
├── _bmad-output/             # Generated planning artifacts
│   └── planning-artifacts/   # PRD, architecture, UX, epics, specs
├── docs/
│   └── project-context.md    # AI agent rules (509 lines, 180 rules)
├── files/                    # Reference documents (PRD .docx, specs)
└── skills/                   # Agent skills (agent-forge, agent-orion)
```

Note: No `apps/`, `packages/`, or `supabase/` directories exist yet — these will be created during implementation.
