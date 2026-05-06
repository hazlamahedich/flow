import {
  Mail,
  MessageSquare,
  CalendarDays,
  CreditCard,
  FileText,
  Sheet,
  Trello,
  Webhook,
  Clock,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ServiceKey } from "@/lib/automations";

const cfg: Record<
  ServiceKey,
  { icon: any; label: string; bg: string; fg: string; ring: string }
> = {
  gmail:    { icon: Mail,         label: "Gmail",    bg: "bg-rose-50",    fg: "text-rose-700",    ring: "ring-rose-200" },
  slack:    { icon: MessageSquare,label: "Slack",    bg: "bg-fuchsia-50", fg: "text-fuchsia-700", ring: "ring-fuchsia-200" },
  calendar: { icon: CalendarDays, label: "Calendar", bg: "bg-emerald-50", fg: "text-emerald-700", ring: "ring-emerald-200" },
  stripe:   { icon: CreditCard,   label: "Stripe",   bg: "bg-violet-50",  fg: "text-violet-700",  ring: "ring-violet-200" },
  notion:   { icon: FileText,     label: "Notion",   bg: "bg-ink-100",    fg: "text-ink-800",     ring: "ring-ink-200" },
  sheets:   { icon: Sheet,        label: "Sheets",   bg: "bg-emerald-50", fg: "text-emerald-700", ring: "ring-emerald-200" },
  trello:   { icon: Trello,       label: "Trello",   bg: "bg-sky-50",     fg: "text-sky-700",     ring: "ring-sky-200" },
  webhook:  { icon: Webhook,      label: "Webhook",  bg: "bg-ink-100",    fg: "text-ink-800",     ring: "ring-ink-200" },
  schedule: { icon: Clock,        label: "Schedule", bg: "bg-amber-50",   fg: "text-amber-700",   ring: "ring-amber-200" },
  filter:   { icon: Filter,       label: "Filter",   bg: "bg-ink-100",    fg: "text-ink-800",     ring: "ring-ink-200" },
};

export function serviceLabel(s: ServiceKey) {
  return cfg[s].label;
}

export function ServiceIcon({
  s,
  size = 28,
  className,
}: {
  s: ServiceKey;
  size?: number;
  className?: string;
}) {
  const c = cfg[s];
  const Icon = c.icon;
  return (
    <span
      className={cn("inline-flex items-center justify-center rounded-lg ring-1", c.bg, c.fg, c.ring, className)}
      style={{ width: size, height: size }}
    >
      <Icon size={Math.round(size * 0.55)} />
    </span>
  );
}
