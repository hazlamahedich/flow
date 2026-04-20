# Calendar Agent Technical Specification

**Flow OS — Companion Document #3**
**Version 1.0  |  April 2026**

---

## 1. Purpose and Scope

This document specifies the Calendar Agent — the 6th agent in Flow OS's mesh and the partner to the Inbox Agent. Where the Inbox Agent triages what arrives, the Calendar Agent protects what's scheduled. Together they cover the two things a VA does most: manage email and manage calendars.

The Calendar Agent is **not** a calendar app. It does not replace Google Calendar. It sits on top of the VA's existing calendar(s), reading events, detecting conflicts, managing booking requests, and coordinating scheduling across multiple clients' calendars — the "calendar tetris" that eats 1-2 hours of every VA's day.

**Design principle:** The Calendar Agent is a **guardian and coordinator**, not a calendar UI. VAs continue using Google Calendar for viewing and manual event creation. Flow OS handles the intelligence layer: conflict detection, booking coordination, rescheduling cascades, and time protection.

---

## 2. Core Concepts

### 2.1 Multi-Calendar Coordination

A VA managing 5-8 clients typically has access to:
- 1 personal calendar
- 1-2 client calendars (via delegated access)
- The client's team's availability (often opaque — the VA guesses)

The Calendar Agent connects to all authorized calendars and maintains a **unified availability view** — not a single merged calendar, but a conflict-aware coordination layer that understands: "Client A's meeting can't move to Thursday because Client B has a block that day."

### 2.2 The Calendar Tetris Problem

The #1 calendar pain for VAs isn't creating events. It's **rescheduling cascades**:

1. Client A cancels Thursday 2pm
2. Client C wants to book that slot
3. But Client C's meeting needs 30min prep, and the VA has Client D's call at 3pm
4. So Client C goes at 2pm, prep at 1:30pm, but 1:30 conflicts with a blocked focus time for Client E's deliverable
5. Move focus time to Friday? But Friday has Client F's weekly standing...

A human VA juggles this mentally across 5-8 clients. The Calendar Agent does it computationally.

### 2.3 Booking Request Pipeline

Many scheduling requests arrive via email ("Can we do Thursday 2pm?"). The Inbox Agent extracts these as action items. The Calendar Agent consumes them and proposes slots:

```
Inbox Agent: extracted action → "Book meeting with Sarah, Thursday 2pm"
Calendar Agent: "Thursday 2pm is open for you but conflicts with Client B's block. Options:
  A) Thursday 3pm (free for both you and Sarah)
  B) Friday 10am
  C) Override — book at 2pm anyway (Client B's block is 'flexible')"
```

### 2.4 Client Bypass Detection

VAs' #1 calendar complaint: "I told the client to always check with me before booking, but they book directly anyway." The Calendar Agent detects:
- New events on client calendars that weren't created by the VA
- Events that overlap with existing commitments
- Patterns: "Client B bypasses you 40% of the time"

This produces signals consumed by Client Health (trust erosion indicator).

---

## 3. Data Schemas

### 3.1 client_calendars table

```sql
CREATE TABLE client_calendars (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id),
  client_id       UUID NOT NULL REFERENCES clients(id),
  provider        TEXT NOT NULL CHECK (provider IN ('google_calendar')),  -- Outlook deferred
  calendar_id     TEXT NOT NULL,  -- Google Calendar ID
  calendar_name   TEXT NOT NULL,
  access_type     TEXT NOT NULL CHECK (access_type IN ('owner', 'read_write', 'read_only')),
  oauth_state     JSONB NOT NULL DEFAULT '{}',  -- encrypted tokens
  sync_cursor     TEXT,  -- Google Calendar sync token for incremental sync
  sync_status     TEXT NOT NULL CHECK (sync_status IN ('connected', 'syncing', 'error', 'disconnected')),
  color_tag       TEXT,  -- visual identifier for this client's events
  last_sync_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, calendar_id)
);
```

### 3.2 calendar_events table

```sql
CREATE TABLE calendar_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id),
  client_calendar_id UUID NOT NULL REFERENCES client_calendars(id),
  client_id       UUID REFERENCES clients(id),  -- NULL if personal/non-client event
  provider_event_id TEXT NOT NULL,  -- Google Calendar event ID
  title           TEXT NOT NULL,
  description     TEXT,
  location        TEXT,
  start_at        TIMESTAMPTZ NOT NULL,
  end_at          TIMESTAMPTZ NOT NULL,
  is_all_day      BOOLEAN NOT NULL DEFAULT FALSE,
  attendees       JSONB DEFAULT '[]',  -- [{email, name, response_status}]
  event_type      TEXT NOT NULL CHECK (event_type IN (
    'meeting', 'focus_block', 'travel', 'personal', 'deadline', 'unknown'
  )),
  source          TEXT NOT NULL CHECK (source IN (
    'va_created', 'client_created', 'third_party', 'auto_generated', 'unknown'
  )),
  is_recurring    BOOLEAN NOT NULL DEFAULT FALSE,
  recurring_rule  TEXT,  -- iCal RRULE if applicable
  created_via     TEXT,  -- 'flow_os' or 'external'
  raw_data        JSONB,  -- full provider event for reference
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (client_calendar_id, provider_event_id)
);

CREATE INDEX idx_cal_events_time ON calendar_events(client_calendar_id, start_at, end_at);
CREATE INDEX idx_cal_events_conflicts ON calendar_events(workspace_id, start_at, end_at)
  WHERE end_at > NOW();
```

### 3.3 scheduling_requests table

```sql
CREATE TABLE scheduling_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id),
  client_id       UUID NOT NULL REFERENCES clients(id),
  source_email_id UUID REFERENCES emails(id),  -- from Inbox Agent extraction
  source_type     TEXT NOT NULL CHECK (source_type IN ('email_extraction', 'va_manual', 'client_portal')),
  request_type    TEXT NOT NULL CHECK (request_type IN (
    'book_new', 'reschedule', 'cancel', 'check_availability'
  )),
  requested_by    JSONB NOT NULL,  -- {name, email, role}
  requested_slots JSONB,  -- [{start_at, end_at}] if specific times proposed
  duration_minutes INTEGER,  -- if only duration specified
  preferences     JSONB DEFAULT '{}',  -- {timezone, avoid_mondays, mornings_only, etc.}
  status          TEXT NOT NULL CHECK (status IN (
    'pending', 'options_proposed', 'option_selected', 'booked', 'failed', 'cancelled'
  )),
  proposed_options JSONB DEFAULT '[]',  -- [{start_at, end_at, conflicts?, reasoning}]
  selected_option  INTEGER,  -- index into proposed_options
  booked_event_id  UUID REFERENCES calendar_events(id),
  agent_run_id     UUID REFERENCES agent_runs(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at      TIMESTAMPTZ
);
```

### 3.4 calendar_conflicts table

```sql
CREATE TABLE calendar_conflicts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id),
  event_a_id      UUID NOT NULL REFERENCES calendar_events(id),
  event_b_id      UUID NOT NULL REFERENCES calendar_events(id),
  conflict_type   TEXT NOT NULL CHECK (conflict_type IN (
    'hard_overlap', 'soft_overlap', 'no_buffer', 'travel_impossible', 'double_booking'
  )),
  severity        TEXT NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
  resolution      TEXT,  -- suggested fix
  resolved_by     TEXT CHECK (resolved_by IN ('va_manual', 'auto_reschedule', 'event_cancelled')),
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (event_a_id, event_b_id)
);
```

### 3.5 agent table addition

```sql
INSERT INTO agents (workspace_id, type, status, config, state, trust_levels)
VALUES (
  :workspace_id,
  'calendar_coordination',
  'setup_required',
  '{
    "default_meeting_duration": 30,
    "buffer_minutes": 15,
    "working_hours": {"start": "08:00", "end": "18:00"},
    "working_days": [1, 2, 3, 4, 5],
    "timezone": "America/New_York",
    "auto_detect_bypass": true,
    "bypass_alert_threshold": 0.3,
    "travel_buffer_minutes": 30
  }'::jsonb,
  '{
    "last_sync_cursor": {},
    "bypass_count_by_client": {},
    "booking_patterns": {},
    "avg_meeting_duration_by_client": {}
  }'::jsonb,
  '{
    "find_available_slots": 0,
    "propose_booking": 0,
    "detect_conflict": 0,
    "detect_bypass": 0,
    "resolve_cascade": 1
  }'::jsonb
);
```

---

## 4. Google Calendar Integration

### 4.1 OAuth + Calendar Access

Reuses the same Google OAuth flow as Inbox Agent with added scope:
- `calendar.readonly` or `calendar.events` (read-write for booking on behalf of VA)

If the VA already connected a client inbox (Gmail), the same OAuth tokens can be extended to Calendar access with incremental consent — no second OAuth dance.

### 4.2 Sync Strategy

```
Initial sync:
  → Pull last 90 days of events per calendar
  → Classify events by type (meeting/focus/travel/personal/deadline/unknown)
  → Build initial conflict map
  → Store sync token for incremental sync

Incremental sync:
  → Google Calendar push notification (via webhook channel)
  → OR: periodic poll every 5 minutes (fallback if push notifications unavailable)
  → Process changes: new events, updated events, cancelled events
  → On new event: classify source (va_created? client_created? third_party?)
  → On new client_created event: check bypass detection
```

### 4.3 Event Source Classification

The agent must determine WHO created each event:

| Source | Detection Method |
|--------|-----------------|
| `va_created` | Event organizer is the VA's email, or event created via Flow OS |
| `client_created` | Event organizer is a client contact, or event appears on client calendar without VA action |
| `third_party` | Event created by Calendly, Acuity, Zoom, etc. (detect via organizer + description patterns) |
| `auto_generated` | Recurring events, holidays, out-of-office auto-replies |
| `unknown` | Can't determine → treated as `client_created` (conservative) |

---

## 5. Signal Catalog — Calendar Agent

### 5.1 Signals Produced

| Signal Type | Severity | Payload | TTL | Consumed By | Dedup Key |
|-------------|----------|---------|-----|-------------|-----------|
| `calendar.conflict_detected` | warn | `{event_a_id, event_b_id, conflict_type, severity}` | Until resolved | VA (Agent Inbox) | `cal.conflict:{event_a_id}:{event_b_id}` |
| `calendar.bypass_detected` | warn | `{client_id, event_id, bypass_count}` | 7d | Client Health | `cal.bypass:{client_id}:{event_id}` |
| `calendar.booking_completed` | info | `{client_id, event_id, start_at}` | 24h | Weekly Report | `cal.booked:{event_id}` |
| `calendar.cascade_triggered` | warn | `{origin_event_id, affected_count, events_affected[]}` | Until resolved | VA (Agent Inbox) | `cal.cascade:{origin_event_id}` |
| `calendar.no_availability` | info | `{client_id, requested_window}` | 48h | VA (Agent Inbox) | `cal.no_avail:{client_id}:{date}` |

### 5.2 Signals Consumed

| Signal Type | Action |
|-------------|--------|
| `email.action_extracted` | If action_type = 'schedule_meeting' or 'reschedule', create scheduling_request |
| `client.contact_updated` | Refresh attendee → client contact mapping |
| `client.score_changed` | If client health drops, tighten bypass detection (lower threshold) |

---

## 6. Agent Specification

### 6.1 Calendar Agent

**Job:** Make the calendar tetris disappear — detect conflicts before they happen, coordinate bookings across clients, and flag when clients bypass the VA.

**Triggers:**
- **Push:** Google Calendar webhook (new/updated/cancelled event)
- **Signal:** `email.action_extracted` (scheduling request from email)
- **Schedule:** Daily 7:00 AM workspace-local time (conflict sweep + day preview)
- **Schedule:** Weekly Monday 6:30 AM (week preview + pattern report)
- **Manual:** VA clicks "Find slots" or "Resolve conflict"

**Tools:**

| Tool | Permission | Proposal-Gated | Notes |
|------|-----------|----------------|-------|
| `query_events` | read | No | Fetch events for calendar(s) in date range |
| `query_calendars` | read | No | List connected calendars and their status |
| `query_client` | read | No | Client metadata, contacts |
| `find_available_slots` | read | No | Compute open slots across calendars with constraints |
| `propose_booking` | write | Yes | Create scheduling proposal (time + reasoning) |
| `create_event` | write | Yes | Create event on calendar (requires VA approval at trust <4) |
| `update_event` | write | Yes | Modify existing event (reschedule) |
| `detect_conflicts` | read | No | Scan for overlaps, tight buffers, travel impossibilities |
| `classify_event_source` | read | No | Determine who created an event |
| `emit_signal` | write | No | Produce signals for mesh |
| `resolve_signal` | write | No | Resolve consumed signals |

**Action Types:**

| Code | Name | Trust Level | Description |
|------|------|-------------|-------------|
| `find_available_slots` | Find Slots | 0 | Given constraints, return available time slots |
| `propose_booking` | Propose Booking | 0 | Suggest specific time(s) for a scheduling request |
| `create_event` | Create Event | 3 | Create calendar event after VA approval |
| `detect_conflict` | Detect Conflict | 0 | Flag overlapping events, buffer violations |
| `detect_bypass` | Detect Bypass | 0 | Flag client-created events that bypass the VA |
| `resolve_cascade` | Resolve Cascade | 1 | When one event moves, propose resolutions for affected events |
| `cancel_event` | Cancel Event | 3 | Cancel event on calendar (requires VA approval) |

### 6.2 Core Logic

**Conflict Detection (real-time, on event change):**

```
On calendar event change (new/updated):
  1. Load all events in workspace overlapping ±2 hours of this event
  2. Check hard overlaps (two events at same time, same attendee = VA)
  3. Check soft conflicts:
     a. Buffer violation: <15 min between events (configurable)
     b. Travel impossible: two locations with <30 min between end and start
     c. Focus block violation: meeting scheduled over marked focus time
  4. Severity scoring:
     a. Hard overlap with client event = critical
     b. Hard overlap with personal event = warning
     c. Buffer/travel violation = warning
     d. Focus block = info
  5. If conflict found:
     a. Write to calendar_conflicts
     b. Emit calendar.conflict_detected signal
     c. Propose resolution: "Move to [slot]? Or keep both?"
```

**Booking Coordination (on email.action_extracted or manual):**

```
On scheduling request:
  1. Parse request: who, when (specific or flexible), duration, timezone
  2. Load all connected calendars for the workspace
  3. Find available slots matching constraints:
     a. Within working hours
     b. No hard conflicts
     c. Adequate buffer before/after
     d. Respect per-client preferences (mornings only, no Mondays, etc.)
  4. If specific time requested:
     a. Check if available → book or propose alternatives
     b. If not available → propose 3 nearest alternatives
  5. If flexible ("sometime next week"):
     a. Propose 3 optimal slots (balanced across days, not clustered)
  6. Create scheduling proposal in Agent Inbox
  7. On VA approval: create event via Google Calendar API
  8. Emit calendar.booking_completed signal
```

**Bypass Detection (on new client-created event):**

```
On new event classified as client_created:
  1. Check if event was preceded by a scheduling request handled by VA
  2. If not → this is a bypass
  3. Increment bypass_count for this client in state
  4. Check if event creates conflicts
  5. If bypass_count / total_client_events > threshold (default 30%):
     a. Emit calendar.bypass_detected signal (Client Health consumes this)
     b. Agent Inbox: "[Client Name] booked directly again (4th time this month). Consider reminding them to check with you first."
  6. Pattern detection (after 30+ events):
     a. "Client B tends to book Friday afternoons — block that time proactively"
     b. "Client C always reschedules within 48 hours — suggest shorter meetings"
```

**Rescheduling Cascade (on event cancellation/move):**

```
On event cancelled or moved:
  1. Find all events that were dependent on the original time:
     a. Buffer events (prep time before, debrief after)
     b. Travel time to/from
     c. Events moved to accommodate this one (check scheduling history)
  2. For each affected event:
     a. Is it now suboptimal? (e.g., prep time no longer needed)
     b. Can it be moved back to a better slot?
  3. Propose cascade resolution:
     a. "Client A cancelled 2pm. You had prep at 1:30 and travel at 3pm.
        Options: A) Free up the whole block. B) Move Client C into the 2pm slot."
  4. On VA choice: execute cascade (update all affected events)
  5. Emit calendar.cascade_triggered signal
```

### 6.3 Daily + Weekly Reports

**Daily Preview (7:00 AM):**

```
Your calendar today:
  3 meetings across 2 clients

  ⚠️ CONFLICT: Client A (2pm) overlaps with focus block (2-3pm)
     → Resolve: move focus block to 4pm? [Yes] [Keep both]

  🔍 BYPASS: Client B booked "Team Sync" at 11am — no request sent to you
     → This is the 3rd bypass this month (bypass rate: 37%)
     → [Send reminder] [Ignore]

  📋 UPCOMING:
  • 9:00am — Client A kickoff call (30min)
  • 11:00am — Client B "Team Sync" (bypass — 30min)
  • 2:00pm — Client A follow-up (CONFLICTS with focus block)
  • 4:30pm — Client C review call (60min)

  💡 SUGGESTION: You have a 90-min gap between 12pm-1:30pm.
     Use it for Client D's deliverable due Friday?
```

**Weekly Preview (Monday 6:30 AM):**

```
Week at a glance:
  14 meetings across 5 clients
  Heaviest day: Wednesday (4 meetings)
  Lightest day: Friday (1 meeting)

  ⚠️ 2 conflicts this week (both Wednesday)
  🔍 1 bypass detected last week (Client B)
  📊 Meeting time: 8.5 hours (down from 10.2 last week)

  Pattern alert: Client C has rescheduled 3 of last 4 meetings.
  Consider: shorter meetings? Different day? Check in about engagement?
```

### 6.4 Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Conflict detection accuracy | >95% of true conflicts caught | Manual QA sampling |
| False positive conflict rate | <10% | VA dismisses without action |
| Bypass detection accuracy | >90% of client-created events correctly classified | Source classification QA |
| Booking proposal acceptance | >70% of proposed slots accepted without manual adjustment | scheduling_requests.selected_option tracking |
| Cascade resolution time | <5 minutes (VA time) from notification to resolution | Conflict → resolution duration |
| Daily preview review time | <3 minutes | First view to last interaction |

---

## 7. Inbox Agent ↔ Calendar Agent Coordination

The two agents work as a pair:

```
Email arrives: "Can we meet Thursday at 2pm?"
  → Inbox Agent: categorize as 'action', extract action: schedule_meeting
  → Inbox Agent: emit email.action_extracted signal
  → Calendar Agent: consume signal, create scheduling_request
  → Calendar Agent: check Thursday 2pm availability
  → Calendar Agent: if available → propose booking
                  → if not → propose 3 alternatives
  → VA sees in Agent Inbox: "Book Sarah for Thursday 2pm? [Confirm] [See alternatives]"
  → VA confirms → Calendar Agent creates Google Calendar event
  → Calendar Agent: emit calendar.booking_completed
  → Weekly Report: includes "Booked meeting with Sarah (Client A)"
```

**The VA never opens Google Calendar.** The entire flow from email to booked meeting happens in Flow OS.

---

## 8. Client Portal Integration

Calendar Agent enables a powerful portal feature: **client self-service scheduling.**

### 8.1 Booking Page

Each client gets a booking link (like Calendly, but built into Flow OS):

- `portal.flow.app/{va-slug}/book?client={client_id}`
- Shows available slots pulled by Calendar Agent
- Client selects a time → creates scheduling_request (source: client_portal)
- Calendar Agent processes → creates event → notifies VA

### 8.2 Rescheduling via Portal

Client clicks "Reschedule" on an upcoming meeting in their portal:
- Calendar Agent finds new slots
- Client picks one
- Old event cancelled, new event created
- VA notified ("Client B rescheduled from Thu 2pm to Fri 10am")

This eliminates the email back-and-forth for rescheduling — the #1 source of scheduling friction.

**Portal scheduling is deferred to Growth phase** (requires portal infrastructure to be stable first). MVP: Calendar Agent handles scheduling from email + manual VA requests only.

---

## 9. Security Considerations

### 9.1 Calendar Data Isolation

Same rules as Inbox Agent:
- Each Calendar Agent run scoped to one workspace
- Events from different clients never share LLM context
- RLS enforced on all calendar tables (workspace + client scoped)
- Calendar content treated as confidential client data

### 9.2 Write Permissions

The Calendar Agent can CREATE and MODIFY events on behalf of the VA. This is the most sensitive write capability in the mesh — incorrect calendar writes directly impact client relationships.

**Safeguards:**
- All event creation/modification is proposal-gated (VA approves) at trust <4
- Trust level 4+ allows auto-create for specific event types (configurable per client)
- Every event creation logged in audit trail with full diff
- Rollback capability: delete event created by agent within 5 minutes if VA flags error
- Client-facing events (meetings with client attendees) NEVER auto-created, regardless of trust level

### 9.3 OAuth Scope Minimization

- Read-only access preferred for client calendars
- Write access only for VA's personal calendar and explicitly authorized client calendars
- VA controls per-calendar write permission during setup
- No access to other users' free/busy data beyond what the calendar API provides natively

---

## 10. Effort Estimate

| Component | Estimated Effort | Dependencies |
|-----------|-----------------|--------------|
| Google Calendar OAuth (extend existing Gmail OAuth) | 1 week | Inbox Agent OAuth |
| Calendar sync pipeline (webhooks + polling) | 1.5 weeks | OAuth, event storage |
| Event storage + classification schemas | 0.5 weeks | RLS design |
| Event source classification logic | 1 week | Calendar sync |
| Conflict detection engine | 1.5 weeks | Event storage, spatial reasoning |
| Booking coordination (slot finding + proposals) | 2 weeks | Conflict engine, scheduling_requests |
| Bypass detection + pattern recognition | 1 week | Event source classification |
| Rescheduling cascade resolution | 1.5 weeks | Conflict engine, booking coordination |
| Daily + weekly preview generation | 0.5 weeks | All above |
| Inbox Agent signal consumption | 0.5 weeks | Inbox Agent production |
| Onboarding flow (calendar connection) | 1 week | OAuth |
| Trust model (booking approval tracking) | 0.5 weeks | All above |
| Cross-client isolation tests | 1 week | All above |
| **Total** | **~8 weeks** | |

Can partially overlap with Inbox Agent development (shared OAuth, shared Google API infrastructure). Net addition to timeline: **~4-6 weeks** (with overlap).

Total project with Inbox Agent + Calendar Agent: **~10-11 months**.

---

## 11. Revised Agent Mesh — Full Stack

| # | Agent | Role | Trigger | Signal Role |
|---|-------|------|---------|-------------|
| 1 | **Inbox Agent** | Email triage, categorization, drafts | Real-time (push) | Producer |
| 2 | **Calendar Agent** | Conflict detection, booking, bypass detection | Real-time + schedule + signal | Producer + Consumer |
| 3 | **AR Collection** | Overdue invoice follow-ups | Schedule + signal | Consumer |
| 4 | **Weekly Report** | Client status summaries | Schedule | Consumer |
| 5 | **Client Health** | Risk scoring (never user-facing) | Schedule + signal | Consumer + Producer |
| 6 | **Time Integrity** | Time tracking gap detection | Schedule + signal | Consumer |

### Signal Flow (Complete)

```
Gmail ──push──→ INBOX AGENT ──signals──→ CALENDAR AGENT
                    │                        │
                    ├→ email.received         ├→ calendar.conflict_detected
                    ├→ email.client_urgent    ├→ calendar.bypass_detected
                    ├→ email.action_extracted ──→ (consumed by Calendar)
                    ├→ email.overdue_mentioned ──→ AR COLLECTION
                    │                              │
                    ├──────────────────────→ CLIENT HEALTH ←──────┐
                    │                        │                    │
                    │                        ├→ client.score_changed
                    │                        │
                    ├──────────────────────→ WEEKLY REPORT
                    │
                    └──────────────────────→ TIME INTEGRITY
```

---

## 12. Open Questions

| # | Question | Impact | Suggested Resolution |
|---|---------|--------|---------------------|
| 1 | Should Calendar Agent handle time-zone coordination (VA in EST, client in PST)? | Medium — adds complexity to slot finding | Yes, essential. Store all times in UTC, display in workspace timezone. Client timezone stored in client record |
| 2 | Support for Calendly/Acuity booking links detected in emails? | Medium — common flow for VAs | Growth phase. MVP: extract as action item, VA handles manually |
| 3 | Recurring event management (detect recurring pattern breaks)? | Medium — standing meetings change often | MVP: detect only. Rescheduling recurring series deferred to Growth |
| 4 | What if VA doesn't have write access to client calendar? | High — can't create events on client side | Fallback: create event on VA's personal calendar only + draft email to client with proposed time |
| 5 | Meeting notes / follow-up task extraction post-meeting? | Low — adjacent to calendar but different domain | Future capability. Calendar Agent could produce signal when meeting ends, consumed by a future Meeting Notes agent |
| 6 | Travel time calculation between locations? | Low — complex, requires maps API | MVP: simple buffer detection (X minutes between events with different locations). Smart travel time deferred |
