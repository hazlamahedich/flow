import { Inbox, CalendarDays, DollarSign, FileBarChart, HeartPulse, Timer } from "lucide-react";
import { cn } from "@/lib/utils";

export type AgentKey = "inbox" | "calendar" | "ar" | "report" | "health" | "time";

const cfg: Record<AgentKey, { icon: any; label: string; ring: string; bg: string; fg: string }> = {
  inbox:    { icon: Inbox,         label: "Inbox Agent",      ring: "ring-violet-200", bg: "bg-violet-50", fg: "text-violet-700" },
  calendar: { icon: CalendarDays,  label: "Calendar Agent",   ring: "ring-emerald-200",bg: "bg-emerald-50",fg: "text-emerald-700" },
  ar:       { icon: DollarSign,    label: "AR Collection",    ring: "ring-amber-200",  bg: "bg-amber-50",  fg: "text-amber-700" },
  report:   { icon: FileBarChart,  label: "Weekly Report",    ring: "ring-cyan-200",   bg: "bg-cyan-50",   fg: "text-cyan-700" },
  health:   { icon: HeartPulse,    label: "Client Health",    ring: "ring-rose-200",   bg: "bg-rose-50",   fg: "text-rose-700" },
  time:     { icon: Timer,         label: "Time Integrity",   ring: "ring-indigo-200", bg: "bg-indigo-50", fg: "text-indigo-700" },
};

export function agentLabel(k: AgentKey) { return cfg[k].label; }

export function AgentIcon({ k, size = 32, className }: { k: AgentKey; size?: number; className?: string }) {
  const c = cfg[k];
  const Icon = c.icon;
  return (
    <span
      className={cn("inline-flex items-center justify-center rounded-lg ring-1", c.ring, c.bg, c.fg, className)}
      style={{ width: size, height: size }}
    >
      <Icon size={Math.round(size * 0.55)} />
    </span>
  );
}

export function AgentChip({ k }: { k: AgentKey }) {
  const c = cfg[k];
  const Icon = c.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1", c.ring, c.bg, c.fg)}>
      <Icon size={12} />
      {c.label}
    </span>
  );
}
