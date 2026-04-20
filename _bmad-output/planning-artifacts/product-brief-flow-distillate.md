---
title: "Product Brief Distillate: Flow OS"
type: llm-distillate
source: "product-brief-flow.md"
created: "2026-04-19"
purpose: "Token-efficient context for downstream PRD creation"
---

# Flow OS — Product Brief Distillate

## Architecture & Technical Constraints

- **Monorepo:** Turborepo with 8+ packages. `apps/web`, `apps/portal`, `services/realtime` (Hocuspocus), `services/agents` (Trigger.dev). Domain packages: clients, projects, time, invoicing. Cross-domain imports blocked in CI via dependency-cruiser.
- **Agent Mesh data model:** 4 tables — `signals` (stigmergic coordination), `agents` (per-workspace instances), `agent_runs` (execution log with cost), `agent_proposals` (inbox items with trust tracking).
- **Signal deduplication:** `deduplication_key` column with unique partial index prevents duplicate active signals. Example: `invoice.overdue:{invoice_id}` ensures one active overdue signal per invoice.
- **Event bus v1:** Postgres LISTEN/NOTIFY (zero new infra, transactional). Migrate to Redis Streams at ~1,000 signals/hour. Signal emission is atomic with DB writes.
- **LLM routing tiers:** Fast (Groq Llama), Balanced (Claude Haiku), Quality (Claude Sonnet). Per-workspace monthly token budgets with graceful degradation. Multi-provider from day one.
- **LLM cost targets per tier:** Solo $5/mo, Agency $25/mo, Agency+ $75/mo in LLM credits. Over-budget degrades to cheaper models, never disables agents.
- **Client portal:** Separate Next.js app (`apps/portal`) sharing packages. Magic-link auth, no account creation. Custom domain support on Agency+ tier. Subdomain pattern: `{slug}.portal.flow.app`.
- **Real-time collaboration:** Yjs/Hocuspocus for the editor (BlockNote/TipTap-based). Separate service process.
- **Security model:** Row-level security on all tables. Portal on separate subdomain with reduced attack surface. GDPR export. EU hosting option. Agent context scoped to single workspace.
- **Scalability path:** 0-100 users free tier ($0/mo infra) → 100-1K ($80-150/mo) → 1K-10K ($400-1K/mo, self-hosted Supabase) → 10K+ (sharded, CDN, dedicated search).

## Agent Specifications

- **4 launch agents:**
  1. **AR Collection** — Follow-up emails for overdue invoices. First agent built (validates mesh before framework extraction).
  2. **Weekly Report** — Auto-generates client status summaries.
  3. **Client Health** — Keystone agent. Never user-facing. Multi-factor deterministic score (no LLM — cheap, auditable, consistent). Produces signals others consume.
  4. **Time Integrity** — Detects gaps and anomalies in time tracking.

- **Client Health Score algorithm:** 0-100 from 4 factors:
  - Payment (30%): <7d=100, 7-14d=85, 14-30d=60, 30-45d=30, >45d=0
  - Approval Latency (25%)
  - Engagement (25%)
  - Work Volume (20%)
  - No LLM used — fully deterministic.

- **Trust progression:** Level 0 (always approve) → Level 3 (10 consecutive clean approvals, auto-execute simple tasks) → Level 5 (full auto for specific actions). Trust is per-action-type, not per-agent.

- **Agent approval rate targets:** 80%+ clean approvals, <15% edit rate, <5% reject rate. 5% of production runs sampled weekly for human review.

- **Build order dogma:** Agent framework extracted AFTER building two concrete agents (AR Collection first, then Weekly Report). Explicitly warns against premature abstraction. Framework earns its existence from two concrete examples.

## Roadmap & Timeline

- **7-month roadmap:** Phase 1 (Foundation, mo 1-2) → Phase 2 (Business Core, mo 3-4) → Phase 3 (Agent Mesh, mo 5) → Phase 4 (Client Portal, mo 6) → Phase 5 (Polish+Launch, mo 7).
- **Phase 1 scope:** Monorepo setup, auth (Supabase), BlockNote editor, database foundation, basic CRUD for core entities.
- **Solo founder constraint:** If 2+ phases behind by month 3, cut client portal to MVP and defer polish. Month 5 (Agent Mesh) is the highest-risk phase.

## Unit Economics

- Blended ARPU $28/mo
- Gross margin 75%+
- CAC <$30
- LTV $670+ (24-month)
- LTV/CAC 20x with viral loop, 5-8x without
- Per-workspace pricing (not per-seat) is a structural advantage — 5-person agency pays $39 total vs $125+ on ClickUp/Notion

## Performance Targets (Flow-Specific)

- Timer start <10 seconds
- Invoice creation <2 minutes
- Agent Inbox clear <5 minutes
- Client portal approval <90 seconds
- Signup-to-first-client <10 minutes

## Competitive Landscape (from Market Research)

- **CrewAI:** Multi-agent orchestration platform with visual editor + API. Open-source core with enterprise AMP management. Gaps: not an OS-level platform, no mesh/p2p topology, enterprise pricing opaque.
- **LangGraph (LangChain):** Low-level agent orchestration framework with stateful workflows, memory, human-in-the-loop. Gaps: developer-tooling-first, requires significant engineering, no unified OS surface.
- **Microsoft AutoGen:** Open-source multi-agent conversation framework. Gaps: research-oriented, no enterprise management layer, primarily sequential chat.
- **IBM watsonx / Agentic AI:** Enterprise AI platform with agentic orchestration bolt-on. Gaps: tightly coupled to IBM ecosystem, bolt-on not agent-native.
- **OpenAI Agents SDK / Swarm:** Lightweight multi-agent orchestration with handoff patterns. Gaps: early-stage, OpenAI-model-locked, no mesh topology.
- **Notion AI / ClickUp Brain / HoneyBook:** Incumbents adding agentic features. Main threat — they already own the VA userbase. Flow OS must win on depth of agent coordination, not just existence of agents.
- **Market size:** AI agents market $52.6B by 2030 (46.3% CAGR). CrewAI reports 450M+ agentic workflows/month, 60% of Fortune 500 engaged. Virtual assistant market $4-5B (20%+ annual growth).

## Rejected Ideas & Decisions

- **Plugin system for v1 — REJECTED.** Plugin system is 10x the commitment. v1 lays groundwork (clean APIs, event bus, tool registry) for later extraction. Deferred to v2.0.
- **Per-seat pricing — REJECTED.** Would cannibalize agency growth story. Per-workspace aligns price with value, not seats.
- **Solo tier at $15 — REJECTED.** Benchmark research showed $15 may signal low quality to the target market. Moved to $19.
- **MIT license — OPEN.** Leaning AGPL to prevent commercial forks, but MIT would maximize adoption. Decision pending trademark/domain research.
- **Custom agent builder for v1 — REJECTED.** Deferred along with plugin system. v1 ships with 4 fixed agents.
- **Mobile app for v1 — REJECTED.** Client portal is mobile-responsive web; native app deferred.

## Open Questions

- **License:** AGPL vs MIT? Needs trademark/domain research before deciding.
- **Beachhead expansion:** Freelance designers, bookkeepers, solo consultants are candidates — no decision yet. Trigger: 3+ paying users from adjacent vertical organically.
- **Long-term vision:** Founder focused on "make it work first." Platform play, Shopify-for-services, and agent marketplace are possibilities but not committed.
- **Co-founder / early hire:** Not addressed. Solo founder for 7-month build. No hiring plan documented.
- **Free → Solo conversion rate:** Assumed possible but unvalidated. VA price sensitivity is a known risk — many use free tiers of everything.
- **Import/migration depth for v1:** Onboarding story includes import from Google Contacts, CSV, Gmail, Trello/Asana/Notion — but priority order and v1 scope for imports is TBD at PRD level.

## User Scenarios (from User Flows doc)

- **Time logging:** Timer start <10 seconds, start/stop/pause on any task, manual entry with auto-suggestions, daily/weekly views.
- **Agent Inbox:** All agent proposals surface in a unified inbox. VA approves, edits, or rejects. Clean approvals build trust level. Inbox clear target <5 minutes.
- **Invoicing:** Create from tracked time in <2 minutes. Auto-populate from project rates and time entries. Send via email or share via portal link.
- **Client portal:** Magic-link auth (no account creation). View project status, approve/reject deliverables, view and pay invoices. Approval target <90 seconds.
- **Client onboarding:** Add client → set rates → assign to project → share portal link. Full flow <10 minutes.

## GTM Details

- **Primary acquisition:** VA community seeding (20 power users in Facebook groups, Discord, VA associations) → organic referrals armed with outcome dashboards.
- **Secondary acquisition:** VA training partnerships (embed as "official OS" in certification programs) → zero-CAC channel at scale.
- **Tertiary acquisition:** VA marketplace platform pilots (Belay, Time Etc, Fancy Hands) → white-label as their back-office OS.
- **Portal viral loop:** VA invites client → client sees branded portal with outcome dashboard → "Powered by Flow OS" footer + referral kickback → client explores Flow OS for own team. Target: 5% client-to-paid-user conversion.
- **Outcome dashboard:** Portal auto-generates monthly value report ("47 tasks, 12 hrs saved, $X delivered"). Makes VA unfireable, Flow OS unswitchable.

## Market & User Sentiment (from Research)

- Developers highlight "brownfield deployment breaks agent architectures" — existing systems lack context and integration hooks agents need.
- Enterprise users want visual editors and copilots for non-technical teams — not just developer SDKs.
- Agent reliability and observability are top pain points — agents that work in demos fail in production.
- "Context gap" is recurring: AI systems fail in enterprise because they lack access to internal context, permissions, and domain-specific data.
- Frustration with vendor lock-in — users want multi-model, multi-tool agent platforms.
- Gartner: Agentic AI is a top 2026 strategic technology trend.
- LLM costs dropping rapidly (GPT-4o mini, Claude Haiku, open-source models) making multi-agent mesh architectures economically viable for first time.
