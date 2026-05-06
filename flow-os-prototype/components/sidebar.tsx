"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Inbox,
  Users,
  CheckSquare,
  Clock,
  Receipt,
  Globe,
  Settings,
  ChevronDown,
  Sparkles,
  Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { agentInbox } from "@/lib/mock-data";
import { automations } from "@/lib/automations";

type NavItem = {
  href: string;
  label: string;
  icon: any;
  count?: () => number;
  v2?: boolean;
};

const nav: NavItem[] = [
  { href: "/", label: "Morning Brief", icon: LayoutDashboard },
  { href: "/inbox", label: "Agent Inbox", icon: Inbox, count: () => agentInbox.filter(p => p.status === "pending").length },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/time", label: "Time", icon: Clock },
  { href: "/invoices", label: "Invoices", icon: Receipt },
  { href: "/automations", label: "Automations", icon: Wand2, count: () => automations.filter(a => a.status === "active").length, v2: true },
  { href: "/portal", label: "Portal Preview", icon: Globe },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-ink-100 bg-white">
      {/* Workspace switcher */}
      <button className="flex items-center gap-3 p-4 hover:bg-ink-50 border-b border-ink-100">
        <div className="size-8 rounded-lg bg-gradient-to-br from-flow-500 to-violet-500 grid place-items-center text-white">
          <Sparkles size={16} />
        </div>
        <div className="flex-1 text-left">
          <div className="text-sm font-semibold text-ink-900">Maya's Workspace</div>
          <div className="text-[11px] text-ink-500">Pro · 8 clients</div>
        </div>
        <ChevronDown size={14} className="text-ink-400" />
      </button>

      <nav className="flex-1 p-3 space-y-1">
        {nav.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const count = item.count?.();
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm",
                active
                  ? "bg-ink-900 text-white"
                  : "text-ink-700 hover:bg-ink-100"
              )}
            >
              <Icon size={16} className="shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.v2 && (
                <span
                  className={cn(
                    "text-[9px] font-bold tracking-wide rounded px-1 py-0.5",
                    active ? "bg-white/15 text-white" : "bg-violet-100 text-violet-700"
                  )}
                >
                  V2
                </span>
              )}
              {count ? (
                <span
                  className={cn(
                    "text-[11px] font-semibold rounded-full px-2 py-0.5",
                    active ? "bg-white/15 text-white" : "bg-flow-100 text-flow-700"
                  )}
                >
                  {count}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-ink-100">
        <div className="rounded-xl border border-ink-100 bg-ink-50 p-3">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-flow-600" />
            <div className="text-xs font-semibold text-ink-800">Trust progression</div>
          </div>
          <p className="text-[11px] text-ink-500 mt-1">
            6/12 agent actions at L2 autonomy. Keep approving clean proposals to unlock more.
          </p>
          <div className="mt-2 h-1.5 w-full rounded-full bg-ink-200 overflow-hidden">
            <div className="h-full bg-flow-600 rounded-full" style={{ width: "50%" }} />
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 px-2">
          <Avatar name="Maya Reyes" size={28} />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-ink-800 truncate">Maya Reyes</div>
            <div className="text-[10px] text-ink-500 truncate">maya@studio-reyes.com</div>
          </div>
          <Badge tone="flow">Pro</Badge>
        </div>
      </div>
    </aside>
  );
}
