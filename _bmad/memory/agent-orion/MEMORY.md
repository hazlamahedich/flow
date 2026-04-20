# Memory

## Project: Flow OS
- **What:** AI-native business OS for VAs and SMEs — replaces fragmented tool stack
- **Core thesis:** 4 specialized AI agents coordinate via stigmergic signals to handle back-office work
- **Stack:** Next.js 15, Supabase, Turborepo, Trigger.dev, BlockNote/Hocuspocus
- **Pricing:** Free/$0, Solo/$19, Agency/$39, Agency+/$79 — per-workspace, not per-seat
- **Target:** Solo VA first (beachhead), then VA agencies, then expansion
- **Viral loop:** Client portal exposes Flow OS to 5-10 clients per VA

## Key Architecture Decisions
- Stigmergic coordination (no agent-to-agent messaging — shared signals)
- Trust-based autonomy (levels 0-5, per-action-type)
- Postgres LISTEN/NOTIFY for v1 event bus, Redis Streams migration planned
- Client Health is keystone agent (deterministic, produces signals others consume)

## Owner's Ask of Me
- Verify and prove what they're implementing
- Critique — find flaws before users do
- Generate new ideas
