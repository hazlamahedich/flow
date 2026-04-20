# Memory

## Project: Flow OS
- **What:** AI-native business OS for VAs and SMEs — replaces fragmented tool stack
- **Founder:** Solo, pre-revenue, bootstrapping, has not run an agency before
- **Core thesis:** 6 specialized AI agents coordinate via shared signals — 2 frontline (Inbox, Calendar) + 4 back-office (AR, Weekly Report, Client Health, Time Integrity)
- **Stack:** Next.js 15, Supabase, Turborepo, Trigger.dev, BlockNote/Hocuspocus
- **Pricing:** Free/$0, Pro/$29, Agency/$59 — per-workspace
- **Target:** Solo VA first (beachhead), then VA agencies, then expansion
- **My Role:** Be the agency brain — red team from an agency operator's perspective
- **Timeline:** ~10-11 months (6-agent MVP)

## Strategic Decisions
- **Beachhead:** VAs managing multiple clients' email inboxes + scheduling
- **MVP workflow:** Morning email triage + daily summary (Inbox Agent) + calendar coordination (Calendar Agent)
- **6-agent commitment locked** — both Orion and Forge validated. Founder chose full 6-agent vision over phased 4→6 approach
- **Inbox Agent (5th):** Gateway agent, push-triggered, signal producer for the mesh
- **Calendar Agent (6th):** Conflict detection, booking coordination, bypass detection

## PRD Validation (2026-04-19)
Both agents reviewed PRD + companion specs. Key findings:
1. **PRD not integrated** — still says 4 agents, $19/mo ghost, no FRs/NFRs for email/calendar
2. **LLM cost broken** — $5/workspace doesn't survive push-triggered Inbox Agent (likely $15-25)
3. **Aha moment wrong** — should be "first on-time payment" not "clear inbox in 5 min"
4. **Portal problem** — stripped MVP portal can't drive viral conversion without outcome dashboard
5. **Missing VA features:** retainer/contract management, client communication history, new client onboarding
6. **Time Integrity = weakest agent** — both agents flag as churn risk, feels like homework

## Key Specs Produced
- `_bmad-output/planning-artifacts/inbox-agent-spec.md` — Inbox Agent spec
- `_bmad-output/planning-artifacts/calendar-agent-spec.md` — Calendar Agent spec
- `_bmad-output/planning-artifacts/prd-validation-reviews.md` — Combined Orion + Forge PRD review

## Product Architecture
- Inbox Agent = input layer (everything flows from email)
- Calendar Agent = coordination layer (booking + conflict + bypass)
- Original 4 agents consume signals produced by Inbox + Calendar
- Total timeline: ~10-11 months
- Calendar Agent overlaps ~4-6 weeks with Inbox Agent development

## Open Items
- PRD needs integration of companion specs (agent count, pricing, FRs, NFRs, timeline, cost model)
- Engineering plan update needed after PRD integration
- Missing features to address: retainer management, communication history, client onboarding
- LLM cost model needs honest recalculation
- Aha moment and portal strategy need rethinking
