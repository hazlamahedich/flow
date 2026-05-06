import type { AgentKey } from "@/components/agent-icon";

export type ServiceKey =
  | "gmail"
  | "slack"
  | "calendar"
  | "stripe"
  | "notion"
  | "sheets"
  | "trello"
  | "webhook"
  | "schedule"
  | "filter";

export type FlowTrigger = {
  kind: "agent_signal" | "schedule" | "webhook" | "manual";
  label: string;
  detail: string;
  signal?: string;
};

export type FlowStep =
  | {
      id: string;
      kind: "agent";
      agent: AgentKey;
      label: string;
      detail: string;
    }
  | {
      id: string;
      kind: "service";
      service: ServiceKey;
      label: string;
      detail: string;
    }
  | {
      id: string;
      kind: "condition";
      label: string;
      detail: string;
    }
  | {
      id: string;
      kind: "delay";
      label: string;
      detail: string;
    };

export type AutomationStatus = "active" | "paused" | "draft" | "error";

export type Automation = {
  id: string;
  name: string;
  description: string;
  status: AutomationStatus;
  source: "natural_language" | "template" | "manual";
  prompt?: string;
  templateId?: string;
  trigger: FlowTrigger;
  steps: FlowStep[];
  runs: { total: number; success: number; failed: number };
  lastRun?: { at: string; status: "success" | "failed"; durationMs: number; note?: string };
  createdAt: string;
};

export type AutomationTemplate = {
  id: string;
  name: string;
  description: string;
  category: "AR" | "Inbox" | "Calendar" | "Reporting" | "Onboarding" | "Operations";
  trigger: FlowTrigger;
  steps: FlowStep[];
  popular?: boolean;
};

const isoMinAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const isoHourAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

export const automations: Automation[] = [
  {
    id: "f1",
    name: "Chase overdue invoices automatically",
    description:
      "When an invoice goes overdue, AR Collection drafts a follow-up. After 3 days with no reply, ping me on Slack and re-send a firmer note.",
    status: "active",
    source: "natural_language",
    prompt:
      "When a client invoice goes overdue, draft a follow-up email and wait 3 days for reply. If no reply, send a Slack alert and a firmer reminder.",
    trigger: {
      kind: "agent_signal",
      label: "Invoice goes overdue",
      detail: "Listens on signal: invoice.overdue",
      signal: "invoice.overdue",
    },
    steps: [
      { id: "s1", kind: "agent", agent: "ar", label: "AR Collection drafts follow-up", detail: "Tone calibrated by reminder count" },
      { id: "s2", kind: "service", service: "gmail", label: "Send draft via Gmail", detail: "From: maya@studio-reyes.com" },
      { id: "s3", kind: "delay", label: "Wait 3 days for reply", detail: "Polls inbox.reply_received" },
      { id: "s4", kind: "condition", label: "If no reply received", detail: "Branch: only continues when no reply detected" },
      { id: "s5", kind: "service", service: "slack", label: "Notify me on Slack", detail: "#payments — DM with invoice context" },
      { id: "s6", kind: "agent", agent: "ar", label: "Send firmer reminder", detail: "Escalation tier: 2" },
    ],
    runs: { total: 47, success: 44, failed: 3 },
    lastRun: { at: isoMinAgo(38), status: "success", durationMs: 4200 },
    createdAt: "2026-04-12",
  },
  {
    id: "f2",
    name: "Welcome new clients",
    description:
      "When a new client is created, send a branded welcome email, create their onboarding Notion page, and add them to the kickoff Trello board.",
    status: "active",
    source: "template",
    templateId: "tpl-onboarding-kickoff",
    trigger: { kind: "webhook", label: "Client created in workspace", detail: "Webhook: workspace.client_created" },
    steps: [
      { id: "s1", kind: "service", service: "gmail", label: "Send welcome email", detail: "Template: Onboarding Welcome v3" },
      { id: "s2", kind: "service", service: "notion", label: "Create onboarding page", detail: "Database: Client Onboarding" },
      { id: "s3", kind: "service", service: "trello", label: "Add to kickoff board", detail: "List: Week 1 — Discovery" },
      { id: "s4", kind: "agent", agent: "report", label: "Schedule first weekly report", detail: "Day 7 from creation" },
    ],
    runs: { total: 12, success: 12, failed: 0 },
    lastRun: { at: isoHourAgo(6), status: "success", durationMs: 2800 },
    createdAt: "2026-04-08",
  },
  {
    id: "f3",
    name: "Auto-flag stalled clients each week",
    description:
      "Every Monday morning, check Client Health scores. If a client drops below 50, alert me and create a recovery task.",
    status: "active",
    source: "natural_language",
    prompt:
      "Every Monday at 8am, run Client Health for all clients. If any score is below 50, send me a Slack DM and create a recovery task in Tasks.",
    trigger: { kind: "schedule", label: "Every Monday at 8:00 AM", detail: "Cron: 0 8 * * 1 (workspace timezone)" },
    steps: [
      { id: "s1", kind: "agent", agent: "health", label: "Run Client Health for all", detail: "Computes 0-100 score per client" },
      { id: "s2", kind: "condition", label: "If score < 50", detail: "Filter: keep clients flagged at-risk or stalled" },
      { id: "s3", kind: "service", service: "slack", label: "DM me with summary", detail: "Per-client risk reasons + last activity" },
      { id: "s4", kind: "service", service: "sheets", label: "Append to weekly digest", detail: "'Client Risk Log' tab" },
    ],
    runs: { total: 4, success: 4, failed: 0 },
    lastRun: { at: isoHourAgo(28), status: "success", durationMs: 6100 },
    createdAt: "2026-04-15",
  },
  {
    id: "f4",
    name: "Friday client digest emails",
    description:
      "Every Friday at 4pm, generate a weekly report per client and send it via the portal. Skip clients on pause.",
    status: "paused",
    source: "template",
    templateId: "tpl-weekly-digest",
    trigger: { kind: "schedule", label: "Every Friday at 4:00 PM", detail: "Cron: 0 16 * * 5 (workspace timezone)" },
    steps: [
      { id: "s1", kind: "condition", label: "Skip paused clients", detail: "Filter: client.status != paused" },
      { id: "s2", kind: "agent", agent: "report", label: "Generate weekly report", detail: "Per client" },
      { id: "s3", kind: "service", service: "gmail", label: "Email via portal link", detail: "Branded — opens in client portal" },
    ],
    runs: { total: 18, success: 17, failed: 1 },
    lastRun: { at: isoHourAgo(72), status: "failed", durationMs: 1900, note: "Step 3 failed — Gmail rate limit (resolved)" },
    createdAt: "2026-03-28",
  },
  {
    id: "f5",
    name: "Resolve calendar conflicts automatically",
    description:
      "If Calendar Agent flags a conflict, propose 3 alternative slots to the requester via email and book once they reply.",
    status: "active",
    source: "natural_language",
    prompt:
      "If the calendar agent finds a meeting conflict, send the requester three alternate times by email. When they reply with a choice, book it.",
    trigger: { kind: "agent_signal", label: "Calendar conflict detected", detail: "Signal: calendar.conflict_detected", signal: "calendar.conflict_detected" },
    steps: [
      { id: "s1", kind: "agent", agent: "calendar", label: "Find 3 free slots", detail: "Within sender timezone, business hours" },
      { id: "s2", kind: "agent", agent: "inbox", label: "Draft reply with options", detail: "Tone: warm, concise" },
      { id: "s3", kind: "service", service: "gmail", label: "Send draft", detail: "Reply-in-thread" },
      { id: "s4", kind: "delay", label: "Await reply", detail: "Polls inbox.scheduling_confirm" },
      { id: "s5", kind: "service", service: "calendar", label: "Book confirmed slot", detail: "Auto-create event + invite" },
    ],
    runs: { total: 23, success: 22, failed: 1 },
    lastRun: { at: isoMinAgo(95), status: "success", durationMs: 3400 },
    createdAt: "2026-04-18",
  },
  {
    id: "f6",
    name: "Stripe payment received → thank-you",
    description:
      "When Stripe confirms a payment, log it to Sheets, post in #wins on Slack, and send a thank-you note from Gmail.",
    status: "draft",
    source: "manual",
    trigger: { kind: "webhook", label: "Stripe payment_intent.succeeded", detail: "Stripe webhook signed via STRIPE_WEBHOOK_SECRET" },
    steps: [
      { id: "s1", kind: "service", service: "sheets", label: "Append payment row", detail: "'Payments 2026' tab" },
      { id: "s2", kind: "service", service: "slack", label: "Post in #wins", detail: "🎉 {client} paid ${amount}" },
      { id: "s3", kind: "service", service: "gmail", label: "Send thank-you email", detail: "Template: Payment Received" },
    ],
    runs: { total: 0, success: 0, failed: 0 },
    createdAt: "2026-04-26",
  },
];

export const automationTemplates: AutomationTemplate[] = [
  {
    id: "tpl-overdue-chase",
    name: "Chase overdue invoices",
    description: "Auto-draft and send escalating follow-ups, with Slack alerts on stuck clients.",
    category: "AR",
    popular: true,
    trigger: { kind: "agent_signal", label: "Invoice goes overdue", detail: "Signal: invoice.overdue" },
    steps: [
      { id: "s1", kind: "agent", agent: "ar", label: "Draft follow-up", detail: "Tone by reminder count" },
      { id: "s2", kind: "service", service: "gmail", label: "Send via Gmail", detail: "From your connected inbox" },
      { id: "s3", kind: "delay", label: "Wait 3 days", detail: "Listens for reply" },
      { id: "s4", kind: "service", service: "slack", label: "Slack alert if no reply", detail: "DM with invoice context" },
    ],
  },
  {
    id: "tpl-calendar-conflict",
    name: "Auto-resolve calendar conflicts",
    description: "Surface 3 alternates by email and book the chosen slot automatically.",
    category: "Calendar",
    popular: true,
    trigger: { kind: "agent_signal", label: "Calendar conflict detected", detail: "Signal: calendar.conflict_detected" },
    steps: [
      { id: "s1", kind: "agent", agent: "calendar", label: "Find 3 free slots", detail: "" },
      { id: "s2", kind: "agent", agent: "inbox", label: "Draft reply", detail: "" },
      { id: "s3", kind: "service", service: "gmail", label: "Send", detail: "" },
      { id: "s4", kind: "service", service: "calendar", label: "Book on reply", detail: "" },
    ],
  },
  {
    id: "tpl-weekly-digest",
    name: "Weekly client digest",
    description: "Friday afternoon: a per-client status summary, sent via the branded portal.",
    category: "Reporting",
    popular: true,
    trigger: { kind: "schedule", label: "Every Friday 4:00 PM", detail: "Cron: 0 16 * * 5" },
    steps: [
      { id: "s1", kind: "agent", agent: "report", label: "Generate weekly report", detail: "" },
      { id: "s2", kind: "service", service: "gmail", label: "Email via portal", detail: "" },
    ],
  },
  {
    id: "tpl-onboarding-kickoff",
    name: "Onboarding kickoff",
    description: "On new client: welcome email + Notion page + Trello kickoff card.",
    category: "Onboarding",
    trigger: { kind: "webhook", label: "Client created", detail: "" },
    steps: [
      { id: "s1", kind: "service", service: "gmail", label: "Welcome email", detail: "" },
      { id: "s2", kind: "service", service: "notion", label: "Onboarding page", detail: "" },
      { id: "s3", kind: "service", service: "trello", label: "Kickoff card", detail: "" },
    ],
  },
  {
    id: "tpl-stalled-clients",
    name: "Stalled-client weekly scan",
    description: "Every Monday, alert me on clients with health < 50 and create recovery tasks.",
    category: "Operations",
    trigger: { kind: "schedule", label: "Every Monday 8:00 AM", detail: "" },
    steps: [
      { id: "s1", kind: "agent", agent: "health", label: "Run Client Health", detail: "" },
      { id: "s2", kind: "condition", label: "If score < 50", detail: "" },
      { id: "s3", kind: "service", service: "slack", label: "DM me", detail: "" },
    ],
  },
  {
    id: "tpl-payment-thanks",
    name: "Payment received → thank-you",
    description: "When Stripe confirms a payment: log, celebrate, and thank.",
    category: "AR",
    trigger: { kind: "webhook", label: "Stripe payment succeeded", detail: "" },
    steps: [
      { id: "s1", kind: "service", service: "sheets", label: "Log payment", detail: "" },
      { id: "s2", kind: "service", service: "slack", label: "Post in #wins", detail: "" },
      { id: "s3", kind: "service", service: "gmail", label: "Thank-you email", detail: "" },
    ],
  },
];

// Mock execution history for the detail page
export type ExecutionEvent = {
  id: string;
  automationId: string;
  status: "success" | "failed" | "running";
  startedAt: string;
  durationMs: number;
  trigger: string;
  steps: { stepId: string; status: "ok" | "failed" | "skipped"; durationMs: number; note?: string }[];
  errorMessage?: string;
};

export const executions: ExecutionEvent[] = [
  {
    id: "e1",
    automationId: "f1",
    status: "success",
    startedAt: isoMinAgo(38),
    durationMs: 4200,
    trigger: "INV-1057 marked overdue",
    steps: [
      { stepId: "s1", status: "ok", durationMs: 1240 },
      { stepId: "s2", status: "ok", durationMs: 480 },
      { stepId: "s3", status: "skipped", durationMs: 0, note: "Reply received within window" },
      { stepId: "s4", status: "ok", durationMs: 60 },
      { stepId: "s5", status: "skipped", durationMs: 0 },
      { stepId: "s6", status: "skipped", durationMs: 0 },
    ],
  },
  {
    id: "e2",
    automationId: "f1",
    status: "success",
    startedAt: isoHourAgo(20),
    durationMs: 5400,
    trigger: "INV-1053 marked overdue",
    steps: [
      { stepId: "s1", status: "ok", durationMs: 1810 },
      { stepId: "s2", status: "ok", durationMs: 510 },
      { stepId: "s3", status: "ok", durationMs: 0, note: "Wait completed (no reply)" },
      { stepId: "s4", status: "ok", durationMs: 80 },
      { stepId: "s5", status: "ok", durationMs: 1200 },
      { stepId: "s6", status: "ok", durationMs: 1800 },
    ],
  },
  {
    id: "e3",
    automationId: "f1",
    status: "failed",
    startedAt: isoHourAgo(48),
    durationMs: 1100,
    trigger: "INV-1042 marked overdue",
    steps: [
      { stepId: "s1", status: "ok", durationMs: 950 },
      { stepId: "s2", status: "failed", durationMs: 150, note: "Gmail OAuth token expired — refreshed automatically" },
    ],
    errorMessage: "Gmail OAuth token expired — surfaced in Agent Inbox; auto-retried at 3:14 AM with success",
  },
  {
    id: "e4",
    automationId: "f1",
    status: "success",
    startedAt: isoHourAgo(72),
    durationMs: 4900,
    trigger: "INV-1029 marked overdue",
    steps: [
      { stepId: "s1", status: "ok", durationMs: 1430 },
      { stepId: "s2", status: "ok", durationMs: 470 },
      { stepId: "s3", status: "ok", durationMs: 0 },
      { stepId: "s4", status: "ok", durationMs: 60 },
      { stepId: "s5", status: "ok", durationMs: 1140 },
      { stepId: "s6", status: "ok", durationMs: 1800 },
    ],
  },
];

// Tier limits per V2 PRD VFR10
export const tierAutomationLimits: Record<"Free" | "Pro" | "Agency", number> = {
  Free: 3,
  Pro: 20,
  Agency: Infinity,
};

// Pre-canned NL → flow generations for the demo. The NL builder picks the best
// match by keyword; otherwise falls back to a generic skeleton.
export type GeneratedFlow = {
  name: string;
  description: string;
  trigger: FlowTrigger;
  steps: FlowStep[];
};

export const nlExamples: { keywords: string[]; flow: GeneratedFlow }[] = [
  {
    keywords: ["overdue", "invoice", "follow", "chase", "ar"],
    flow: {
      name: "Chase overdue invoices",
      description: "Drafts a follow-up when an invoice goes overdue and escalates if no reply.",
      trigger: { kind: "agent_signal", label: "Invoice goes overdue", detail: "Signal: invoice.overdue" },
      steps: [
        { id: "g1", kind: "agent", agent: "ar", label: "AR Collection drafts follow-up", detail: "Tone scaled to reminder count" },
        { id: "g2", kind: "service", service: "gmail", label: "Send via Gmail", detail: "From your connected inbox" },
        { id: "g3", kind: "delay", label: "Wait for reply (3 days)", detail: "Listens on inbox signals" },
        { id: "g4", kind: "service", service: "slack", label: "Slack alert if no reply", detail: "DM you with invoice context" },
      ],
    },
  },
  {
    keywords: ["weekly", "report", "client", "summary", "digest", "friday"],
    flow: {
      name: "Friday client digest",
      description: "Generate a weekly report per client and email it via the portal each Friday.",
      trigger: { kind: "schedule", label: "Every Friday 4:00 PM", detail: "Cron: 0 16 * * 5" },
      steps: [
        { id: "g1", kind: "agent", agent: "report", label: "Generate weekly report per client", detail: "" },
        { id: "g2", kind: "service", service: "gmail", label: "Email via portal link", detail: "Branded — opens in client portal" },
      ],
    },
  },
  {
    keywords: ["onboard", "welcome", "new client"],
    flow: {
      name: "New-client onboarding",
      description: "On new client, send welcome email, set up Notion page, add to Trello board.",
      trigger: { kind: "webhook", label: "Client created", detail: "Webhook: workspace.client_created" },
      steps: [
        { id: "g1", kind: "service", service: "gmail", label: "Send welcome email", detail: "Template: Welcome v3" },
        { id: "g2", kind: "service", service: "notion", label: "Create onboarding page", detail: "" },
        { id: "g3", kind: "service", service: "trello", label: "Add kickoff card", detail: "" },
      ],
    },
  },
  {
    keywords: ["stalled", "risk", "health", "score"],
    flow: {
      name: "Stalled-client weekly scan",
      description: "Every Monday, run Client Health and flag clients below 50.",
      trigger: { kind: "schedule", label: "Every Monday 8:00 AM", detail: "" },
      steps: [
        { id: "g1", kind: "agent", agent: "health", label: "Run Client Health for all", detail: "" },
        { id: "g2", kind: "condition", label: "If score < 50", detail: "" },
        { id: "g3", kind: "service", service: "slack", label: "DM me with risk reasons", detail: "" },
      ],
    },
  },
  {
    keywords: ["calendar", "conflict", "reschedule"],
    flow: {
      name: "Auto-resolve calendar conflicts",
      description: "When Calendar Agent finds a conflict, propose 3 alternates and book on reply.",
      trigger: { kind: "agent_signal", label: "Calendar conflict detected", detail: "Signal: calendar.conflict_detected" },
      steps: [
        { id: "g1", kind: "agent", agent: "calendar", label: "Find 3 free slots", detail: "" },
        { id: "g2", kind: "agent", agent: "inbox", label: "Draft reply with options", detail: "" },
        { id: "g3", kind: "service", service: "gmail", label: "Send draft", detail: "" },
        { id: "g4", kind: "service", service: "calendar", label: "Book confirmed slot", detail: "" },
      ],
    },
  },
];

export function generateFlowFromPrompt(prompt: string): GeneratedFlow {
  const p = prompt.toLowerCase();
  let best: { score: number; flow: GeneratedFlow } | null = null;
  for (const ex of nlExamples) {
    const score = ex.keywords.reduce((acc, k) => acc + (p.includes(k) ? 1 : 0), 0);
    if (score > 0 && (!best || score > best.score)) best = { score, flow: ex.flow };
  }
  if (best) return best.flow;
  // Fallback skeleton
  return {
    name: "New automation",
    description: prompt.slice(0, 140),
    trigger: { kind: "manual", label: "Run manually", detail: "Add a real trigger before activating" },
    steps: [
      {
        id: "g1",
        kind: "agent",
        agent: "inbox",
        label: "Use an agent here",
        detail: "Pick from Inbox / Calendar / AR / Report / Health / Time",
      },
      {
        id: "g2",
        kind: "service",
        service: "gmail",
        label: "Send a notification",
        detail: "Or pick another integration",
      },
    ],
  };
}
