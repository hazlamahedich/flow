import type { AgentKey } from "@/components/agent-icon";

export type ClientStatus = "healthy" | "at-risk" | "stalled" | "new";

export type Client = {
  id: string;
  name: string;
  contact: string;
  email: string;
  status: ClientStatus;
  health: number; // 0-100
  mrr: number;
  hoursThisWeek: number;
  outstandingAR: number;
  lastActivity: string; // ISO
  nextAction?: string;
  tags?: string[];
};

export const clients: Client[] = [
  {
    id: "c1",
    name: "Northstar Wealth",
    contact: "Daniel Park",
    email: "daniel@northstarwealth.co",
    status: "healthy",
    health: 88,
    mrr: 1800,
    hoursThisWeek: 6.5,
    outstandingAR: 0,
    lastActivity: new Date(Date.now() - 1000 * 60 * 22).toISOString(),
    nextAction: "Review weekly report draft",
    tags: ["finance", "retainer"],
  },
  {
    id: "c2",
    name: "Bramble & Co",
    contact: "Sara Bramble",
    email: "sara@bramble.co",
    status: "at-risk",
    health: 54,
    mrr: 1200,
    hoursThisWeek: 2.1,
    outstandingAR: 1450,
    lastActivity: new Date(Date.now() - 1000 * 60 * 60 * 28).toISOString(),
    nextAction: "AR follow-up scheduled",
    tags: ["consulting"],
  },
  {
    id: "c3",
    name: "Lumen Studio",
    contact: "Priya Iyer",
    email: "priya@lumen.studio",
    status: "healthy",
    health: 92,
    mrr: 2400,
    hoursThisWeek: 9.3,
    outstandingAR: 0,
    lastActivity: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
    nextAction: "Share Q2 outcome dashboard",
    tags: ["design", "retainer"],
  },
  {
    id: "c4",
    name: "Harbor Legal",
    contact: "Mark Whitlow",
    email: "mwhitlow@harborlegal.com",
    status: "stalled",
    health: 38,
    mrr: 900,
    hoursThisWeek: 0.5,
    outstandingAR: 2100,
    lastActivity: new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString(),
    nextAction: "Bypass risk: client booked outside Calendly",
    tags: ["legal"],
  },
  {
    id: "c5",
    name: "Roastline Coffee",
    contact: "Jules Carter",
    email: "jules@roastline.co",
    status: "healthy",
    health: 78,
    mrr: 750,
    hoursThisWeek: 4.0,
    outstandingAR: 0,
    lastActivity: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    tags: ["retail"],
  },
  {
    id: "c6",
    name: "Vector Robotics",
    contact: "Hiro Tanaka",
    email: "hiro@vectorrobotics.io",
    status: "new",
    health: 70,
    mrr: 1500,
    hoursThisWeek: 1.2,
    outstandingAR: 0,
    lastActivity: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    nextAction: "Onboarding: send welcome packet",
    tags: ["tech", "new"],
  },
  {
    id: "c7",
    name: "Field & Forge",
    contact: "Alana Reeve",
    email: "alana@fieldandforge.com",
    status: "healthy",
    health: 81,
    mrr: 1100,
    hoursThisWeek: 5.5,
    outstandingAR: 0,
    lastActivity: new Date(Date.now() - 1000 * 60 * 60 * 14).toISOString(),
    tags: ["e-commerce"],
  },
  {
    id: "c8",
    name: "Quill & Quartz",
    contact: "Rosa Mendoza",
    email: "rosa@quillquartz.com",
    status: "at-risk",
    health: 61,
    mrr: 600,
    hoursThisWeek: 1.8,
    outstandingAR: 600,
    lastActivity: new Date(Date.now() - 1000 * 60 * 60 * 50).toISOString(),
    nextAction: "Invoice #INV-1042 follow-up",
    tags: ["jewelry"],
  },
];

export type Task = {
  id: string;
  title: string;
  clientId: string;
  status: "todo" | "doing" | "review" | "done";
  due?: string;
  estimateHrs?: number;
  origin?: "agent" | "manual";
  agentSource?: AgentKey;
};

export const tasks: Task[] = [
  { id: "t1", title: "Send Q1 retainer invoice", clientId: "c1", status: "review", due: "today", estimateHrs: 0.5, origin: "agent", agentSource: "ar" },
  { id: "t2", title: "Reschedule Tuesday standup (conflict)", clientId: "c3", status: "doing", due: "today", estimateHrs: 0.25, origin: "agent", agentSource: "calendar" },
  { id: "t3", title: "Draft press release — Series A", clientId: "c6", status: "todo", due: "Fri", estimateHrs: 3 },
  { id: "t4", title: "Compile weekly client report", clientId: "c1", status: "review", due: "today", estimateHrs: 0.75, origin: "agent", agentSource: "report" },
  { id: "t5", title: "Inbox triage: Bramble follow-ups", clientId: "c2", status: "doing", estimateHrs: 0.5, origin: "agent", agentSource: "inbox" },
  { id: "t6", title: "Update product photography brief", clientId: "c7", status: "todo", due: "Wed", estimateHrs: 1.5 },
  { id: "t7", title: "Confirm catering for offsite", clientId: "c5", status: "done", estimateHrs: 0.5 },
  { id: "t8", title: "Audit time entries for Mar 14-21", clientId: "c4", status: "todo", due: "Thu", estimateHrs: 1, origin: "agent", agentSource: "time" },
  { id: "t9", title: "Onboarding: gather brand assets", clientId: "c6", status: "doing", estimateHrs: 1, origin: "manual" },
  { id: "t10", title: "Pay vendor: Canva Pro renewal", clientId: "c3", status: "todo", due: "Mon", estimateHrs: 0.25 },
];

export type TimeEntry = {
  id: string;
  clientId: string;
  taskId?: string;
  description: string;
  startedAt: string;
  durationMin: number;
  billable: boolean;
};

const today = new Date();
const todayAt = (h: number, m = 0) => {
  const d = new Date(today);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

export const timeEntries: TimeEntry[] = [
  { id: "te1", clientId: "c1", taskId: "t4", description: "Drafted weekly status report", startedAt: todayAt(8, 30), durationMin: 45, billable: true },
  { id: "te2", clientId: "c3", taskId: "t2", description: "Calendar reshuffle — moved 2 mtgs", startedAt: todayAt(9, 20), durationMin: 18, billable: true },
  { id: "te3", clientId: "c2", taskId: "t5", description: "Inbox triage + 3 client replies", startedAt: todayAt(9, 45), durationMin: 32, billable: true },
  { id: "te4", clientId: "c6", taskId: "t9", description: "Onboarding deck v2", startedAt: todayAt(10, 30), durationMin: 75, billable: true },
  { id: "te5", clientId: "c4", description: "Internal: agent QA review", startedAt: todayAt(13, 0), durationMin: 25, billable: false },
  { id: "te6", clientId: "c7", description: "Photography brief revisions", startedAt: todayAt(14, 0), durationMin: 50, billable: true },
];

export type Invoice = {
  id: string;
  number: string;
  clientId: string;
  amount: number;
  status: "draft" | "sent" | "paid" | "overdue" | "partial";
  issued?: string;
  due?: string;
  paidAt?: string;
  daysOverdue?: number;
};

export const invoices: Invoice[] = [
  { id: "i1", number: "INV-1051", clientId: "c1", amount: 1800, status: "paid", issued: "2026-04-01", paidAt: "2026-04-04" },
  { id: "i2", number: "INV-1052", clientId: "c3", amount: 2400, status: "paid", issued: "2026-04-02", paidAt: "2026-04-03" },
  { id: "i3", number: "INV-1053", clientId: "c2", amount: 1450, status: "overdue", issued: "2026-03-28", due: "2026-04-11", daysOverdue: 18 },
  { id: "i4", number: "INV-1054", clientId: "c4", amount: 2100, status: "overdue", issued: "2026-03-22", due: "2026-04-05", daysOverdue: 24 },
  { id: "i5", number: "INV-1055", clientId: "c7", amount: 1100, status: "sent", issued: "2026-04-22", due: "2026-05-06" },
  { id: "i6", number: "INV-1056", clientId: "c5", amount: 750, status: "sent", issued: "2026-04-25", due: "2026-05-09" },
  { id: "i7", number: "INV-1057", clientId: "c8", amount: 600, status: "overdue", issued: "2026-04-01", due: "2026-04-15", daysOverdue: 14 },
  { id: "i8", number: "INV-1058", clientId: "c6", amount: 1500, status: "draft" },
];

export type TrustLevel = 0 | 1 | 2 | 3;
export const trustLabels: Record<TrustLevel, string> = {
  0: "Supervised",
  1: "Notify",
  2: "Auto-act with summary",
  3: "Autonomous",
};

export type AgentProposal = {
  id: string;
  agent: AgentKey;
  clientId?: string;
  title: string;
  summary: string;
  draftSubject?: string;
  draftBody?: string;
  rationale?: string[];
  signals?: string[];
  trustLevel: TrustLevel;
  status: "pending" | "approved" | "rejected" | "edited";
  createdAt: string;
  confidence?: number; // 0-1
  willTakeAction?: string;
};

const isoMinAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

export const agentInbox: AgentProposal[] = [
  {
    id: "p1",
    agent: "ar",
    clientId: "c2",
    title: "Follow up on overdue invoice INV-1053",
    summary: "Bramble & Co invoice $1,450 is 18 days overdue. Drafted a friendly nudge — third reminder, tone escalates politely.",
    draftSubject: "Quick check-in on INV-1053",
    draftBody:
      "Hi Sara,\n\nHope your week is going well! Just circling back on invoice INV-1053 ($1,450) from Mar 28. It's now 18 days past due — could you confirm where it sits in your AP queue?\n\nHappy to hop on a quick call if there's anything I can help unblock.\n\nThanks so much,\nMaya",
    rationale: [
      "Invoice 18 days overdue (threshold: 14)",
      "Last 2 reminders unanswered (Apr 12, Apr 19)",
      "Client Health agent flagged risk — score dropped to 54",
    ],
    signals: ["client_health.risk_increased", "invoice.overdue"],
    trustLevel: 2,
    status: "pending",
    createdAt: isoMinAgo(8),
    confidence: 0.91,
    willTakeAction: "Send email + log activity + schedule 5-day follow-up",
  },
  {
    id: "p2",
    agent: "inbox",
    clientId: "c3",
    title: "Triage: Priya asked to move Thursday call",
    summary: "Email from Priya at Lumen Studio requesting a reschedule of the Thursday 2 PM call. Calendar Agent has 3 alternative slots ready.",
    draftSubject: "Re: Can we move Thursday's call?",
    draftBody:
      "Hi Priya,\n\nNo problem at all — here are three options that work on my end this week:\n\n• Thu 4:00–4:45 PM\n• Fri 10:00–10:45 AM\n• Fri 1:30–2:15 PM\n\nLet me know what works and I'll send the calendar invite right after.\n\nMaya",
    rationale: [
      "Detected scheduling intent: 'can we move Thursday'",
      "Calendar Agent: 3 free slots within client's stated timezone",
      "Past pattern: Priya prefers afternoon slots",
    ],
    signals: ["inbox.scheduling_request", "calendar.slots_available"],
    trustLevel: 2,
    status: "pending",
    createdAt: isoMinAgo(22),
    confidence: 0.94,
    willTakeAction: "Send reply with proposed slots; auto-book once confirmed",
  },
  {
    id: "p3",
    agent: "calendar",
    clientId: "c4",
    title: "Bypass detected — Mark booked directly via Calendly",
    summary: "Mark Whitlow (Harbor Legal) booked a 30-min call Thursday using your old personal Calendly — bypassing the workspace flow.",
    rationale: [
      "Booking origin: maya-direct.calendly.com (legacy link)",
      "Client expected to use harbor-legal.flow.app/book",
      "Same pattern occurred Apr 9 and Apr 17",
    ],
    signals: ["calendar.bypass_detected"],
    trustLevel: 1,
    status: "pending",
    createdAt: isoMinAgo(45),
    confidence: 0.88,
    willTakeAction: "Notify only — propose disabling legacy Calendly link",
  },
  {
    id: "p4",
    agent: "report",
    clientId: "c1",
    title: "Weekly report draft for Northstar Wealth",
    summary: "Auto-generated Apr 22–28 client report. 6 tasks delivered, 2 in flight. Tone: professional, concise. Ready for review before sending.",
    rationale: [
      "6 completed tasks in window",
      "Time tracked: 6.5 hrs (vs 8 hr cap)",
      "Includes outcome dashboard preview",
    ],
    signals: [],
    trustLevel: 1,
    status: "pending",
    createdAt: isoMinAgo(68),
    confidence: 0.87,
    willTakeAction: "Save as draft for review (will not send without approval)",
  },
  {
    id: "p5",
    agent: "time",
    clientId: "c4",
    title: "Time tracking gap detected — Apr 25",
    summary: "Found a 3.5-hour gap on Friday with calendar events but no time entries. Likely an unlogged client call + prep.",
    rationale: [
      "Calendar shows 2 Harbor Legal events totaling 90 min",
      "Inbox shows 4 outbound emails to Mark in same window",
      "No time entries logged",
    ],
    signals: ["time.gap_detected"],
    trustLevel: 0,
    status: "pending",
    createdAt: isoMinAgo(110),
    confidence: 0.79,
    willTakeAction: "Create draft time entry; awaits your approval",
  },
  {
    id: "p7",
    agent: "ar",
    clientId: "c4",
    title: "Automation step failed — Gmail OAuth expired",
    summary:
      "'Chase overdue invoices' automation halted on step 2 (Send via Gmail) for Harbor Legal. Token has been refreshed automatically — needs your sign-off to retry.",
    rationale: [
      "Activepieces flow id: f1, run e3",
      "Step 2 (Gmail) returned 401",
      "Token refreshed at 3:14 AM via OAuth refresh",
    ],
    signals: ["automation.step_failed"],
    trustLevel: 1,
    status: "pending",
    createdAt: isoMinAgo(170),
    confidence: 0.99,
    willTakeAction: "Re-run flow from step 2 with refreshed credentials",
  },
  {
    id: "p6",
    agent: "ar",
    clientId: "c8",
    title: "Follow up on overdue invoice INV-1057",
    summary: "Quill & Quartz invoice $600 is 14 days overdue. First reminder — gentle tone.",
    draftSubject: "Friendly nudge on INV-1057",
    draftBody:
      "Hi Rosa,\n\nHope you're well! Just a gentle reminder that INV-1057 ($600) hit its due date last week. If it's already in motion, no worries — just let me know and I'll mark it as such.\n\nWarmly,\nMaya",
    rationale: ["Crossed 14-day threshold today", "First reminder — soft tone"],
    signals: ["invoice.overdue"],
    trustLevel: 2,
    status: "pending",
    createdAt: isoMinAgo(140),
    confidence: 0.93,
    willTakeAction: "Send email + log activity",
  },
];

export type ActivityItem = {
  id: string;
  agent: AgentKey;
  text: string;
  clientId?: string;
  at: string;
  result?: "auto" | "approved" | "edited" | "rejected";
};

export const recentActivity: ActivityItem[] = [
  { id: "a1", agent: "inbox", text: "Triaged 27 overnight emails (4 urgent, 11 actions, 12 noise)", at: isoMinAgo(2) },
  { id: "a2", agent: "ar", text: "Sent 2nd reminder for INV-1057 to Rosa Mendoza", clientId: "c8", at: isoMinAgo(140), result: "auto" },
  { id: "a3", agent: "calendar", text: "Resolved conflict: moved Lumen Studio call to Fri 10 AM", clientId: "c3", at: isoMinAgo(160), result: "approved" },
  { id: "a4", agent: "report", text: "Generated weekly report for Field & Forge", clientId: "c7", at: isoMinAgo(220), result: "approved" },
  { id: "a5", agent: "health", text: "Bramble & Co health score dropped 12 → 54", clientId: "c2", at: isoMinAgo(240) },
  { id: "a6", agent: "inbox", text: "Drafted reply to Daniel @ Northstar (re: Q1 wrap-up)", clientId: "c1", at: isoMinAgo(280), result: "edited" },
];

export const briefStats = {
  urgent: 3,
  actions: 8,
  autoHandled: 12,
  collectedThisWeek: 4200,
  trackedThisWeek: 31.2,
};

export const todayCalendar = [
  { time: "9:00 AM", title: "Northstar weekly sync", client: "Northstar Wealth", duration: "30m" },
  { time: "10:30 AM", title: "Lumen creative review", client: "Lumen Studio", duration: "45m" },
  { time: "1:00 PM", title: "Vector onboarding kickoff", client: "Vector Robotics", duration: "1h" },
  { time: "3:30 PM", title: "Internal: agent QA review", client: "Maya's Workspace", duration: "30m" },
];

export type AgentTrust = {
  k: AgentKey;
  cleanRate: number;
  editRate: number;
  rejectRate: number;
  level: TrustLevel;
  proposalsThisWeek: number;
};

export const agentTrust: AgentTrust[] = [
  { k: "inbox",    cleanRate: 0.86, editRate: 0.10, rejectRate: 0.04, level: 2, proposalsThisWeek: 142 },
  { k: "calendar", cleanRate: 0.82, editRate: 0.13, rejectRate: 0.05, level: 2, proposalsThisWeek: 28 },
  { k: "ar",       cleanRate: 0.91, editRate: 0.07, rejectRate: 0.02, level: 2, proposalsThisWeek: 9 },
  { k: "report",   cleanRate: 0.74, editRate: 0.22, rejectRate: 0.04, level: 1, proposalsThisWeek: 8 },
  { k: "time",     cleanRate: 0.69, editRate: 0.25, rejectRate: 0.06, level: 0, proposalsThisWeek: 12 },
  { k: "health",   cleanRate: 0.94, editRate: 0.04, rejectRate: 0.02, level: 3, proposalsThisWeek: 0 }, // never user-facing
];

export const tiers = [
  {
    name: "Free",
    price: 0,
    blurb: "Get paid faster, on us",
    features: ["2 clients", "1 agent (AR Collection, 3/wk)", "Solo workspace", "Stripe (5% fee)", "Email support"],
    current: false,
  },
  {
    name: "Pro",
    price: 29,
    blurb: "Solo VAs running their full book",
    features: ["15 clients", "All 6 agents", "Solo workspace", "Stripe included", "Branded portal (simplified)", "Priority support"],
    current: true,
  },
  {
    name: "Agency",
    price: 59,
    blurb: "Teams running multi-VA agencies",
    features: ["Unlimited clients", "All 6 agents", "Unlimited team members", "Stripe Connect", "Full branded portal", "SLA + concierge onboarding"],
    current: false,
  },
];
