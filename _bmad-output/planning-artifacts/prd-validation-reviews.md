# Flow OS PRD Validation — Agent Reviews

**Date:** 2026-04-19
**Reviewed:** prd.md (1,407 lines), inbox-agent-spec.md, calendar-agent-spec.md

---

## Orion's Validation (SME Perspective)

### Thesis: Sound but underproven
- Pain point is real and well-argued
- "User research confirms" (line 46) has no citation — what research?
- "5% client conversion" target is aspirational, not derived
- Trust assumption is named but not stress-tested with a fallback

### 7 Internal Contradictions Found
1. **Agent count** — PRD says 4, specs say 6. Coordination thesis architecturally neutered in MVP (pg-boss instead of signals).
2. **$19/mo ghost** — Line 62 references $19 but pricing is $29. Copy-paste artifact.
3. **Trust levels** — Narrative uses 0-5, implementation uses 3 (supervised/confirm/auto). Confusing.
4. **Calendar timing** — PRD says v1.1 (30 days post-launch), but Calendar Agent spec needs it in MVP.
5. **Solo founder scope** — 6 agents + 10-11 months exceeds the 9-month hard stop at line 1134.
6. **No FRs for email/calendar** — 28 FRs cover 4 agents. Inbox and Calendar have zero.
7. **No NFR for push latency** — Inbox Agent needs <60s processing. Not in NFRs.

### Unaddressed Risks
- Gmail API dependency (Google deprecates APIs regularly)
- Scope creep from companion specs (18 extra weeks)
- Voice profile data as impersonation liability
- Inbox→Calendar race conditions
- LLM cost model: $5/workspace/month → likely $15-25 with Inbox Agent processing all emails

### Agent Assessment
- AR Collection: **Strong** — highest ROI, clearest value
- Weekly Report: **Good** — coordination value is real
- Client Health: **Smart architecture** — never user-facing, signal producer
- Time Integrity: **Weakest** — Journey 7 shows VAs find it "naggy"
- Inbox Agent: **Most valuable** — daily habit formation, gateway agent. But 10-week estimate optimistic.
- Calendar Agent: **Strong but over-engineered** — cascade resolution is graph traversal. 80% value from conflict+bypass detection alone.

### Verdict
"PRD is a 9/10 document for a funded startup. For a solo founder, it needs to be 60% shorter and 100% more focused. The Inbox and Calendar agents are exactly the right agents to build next — they're just not the right agents to build first."

---

## Forge's Red Team (Agency Operator Perspective)

### VA Reality Check
4-agent MVP solves only 25-30% of a VA's actual daily pain. The other 75% (email triage, scheduling, client communication) is in the companion specs, not the PRD.

### The 4-Agent Problem
- AR Collection = HIGH value (saves time, makes money)
- Weekly Report = MEDIUM
- Client Health = LOW (VA already knows by gut)
- Time Integrity = NEGATIVE (feels like homework, PRD admits this at line 406)
- Only AR Collection directly saves time and makes money

### Aha Moment is Wrong
PRD: "VA clears Agent Inbox in under 5 minutes" — this is an engineer's aha.
Real aha: "VA receives first on-time payment through portal within 14 days." Money arriving faster. Measurable, emotional.

### Portal Problem
PRD positions portal as THE growth engine (line 64). But MVP portal is "approve + pay only" — no outcome dashboard. The viral moment (Journey 4) requires the dashboard. Stripped portal = Stripe checkout page. Can't drive viral conversion.

### 3 Things Missing From a VA's Perspective
1. **Retainer/contract management** — VAs bill flat rates, not just hourly. No scope tracking, package billing, or retainer monitoring.
2. **Client communication history** — No unified timeline per client. No conversation context for agents.
3. **Client onboarding** — No "new client setup wizard." VAs need to look professional from day 1 with a new client.

### Pricing Assessment
- Free tier: Well-calibrated for full-time VAs (5% fee > $29 Pro), but bad for converting part-time VAs
- Pro $29: **Right price** — cheaper than HoneyBook/Dubsado with AI agents
- Agency $59: **Underpriced** — Stripe Connect compliance costs may eat the margin

### Cold Start Problem
"Biweekly user interviews from day 1" (line 961) is unrealistic. No VA network, no community strategy, no content plan. Realistic: monthly interviews starting month 4.

### Verdict
"The specs ARE the product. The PRD describes the infrastructure. Fix the integration."

---

## Where Orion and Forge DISAGREE

| Issue | Orion Says | Forge Says |
|-------|-----------|------------|
| Ship order | 4-agent MVP first → validate → add Inbox/Calendar | 4-agent MVP only solves 25% of pain. Inbox Agent IS the product. |
| Risk profile | Scope is the biggest risk — cut everything to match solo capacity | Solving the wrong problem is the biggest risk — ship what matters |
| Timeline | Stick to 7 months + hard stop | Ship 4 agents at 7 months, Inbox at 8.5, Calendar at 10 |
| Aha moment | (didn't address) | Wrong — should be "first on-time payment," not "clear inbox" |

## Where They AGREE

1. **PRD hasn't absorbed the companion specs** — this is the #1 blocker to implementation
2. **LLM cost model is broken** — $5/workspace doesn't survive push-triggered agents
3. **Trust system needs clarity** — 3 levels vs 0-5 narrative is confusing
4. **Gmail/Calendar integrations can't be post-launch** if agents are in MVP
5. **Free tier needs work** — both flag issues with conversion mechanics
6. **Time Integrity is the weakest agent** — both identify it as churn risk
