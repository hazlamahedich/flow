import Link from "next/link";
import { ArrowUpRight, Inbox, AlertTriangle, CheckCheck, Wallet, Clock4, CalendarDays } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProposalCard } from "@/components/proposal-card";
import { AgentIcon } from "@/components/agent-icon";
import {
  agentInbox,
  briefStats,
  recentActivity,
  todayCalendar,
  clients,
} from "@/lib/mock-data";
import { formatCurrency, relTime } from "@/lib/utils";

export default function MorningBriefPage() {
  const topProposals = agentInbox.filter((p) => p.status === "pending").slice(0, 3);

  return (
    <>
      <Topbar
        title="Good morning, Maya"
        subtitle={`Wednesday, April 29 · ${briefStats.urgent} urgent · ${briefStats.actions} actions waiting · ${briefStats.autoHandled} auto-handled overnight`}
      />

      <div className="p-6 space-y-6 max-w-[1200px]">
        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<AlertTriangle size={16} />}
            tone="warn"
            label="Urgent"
            value={briefStats.urgent.toString()}
            sub="Need a decision today"
          />
          <StatCard
            icon={<Inbox size={16} />}
            tone="flow"
            label="Actions waiting"
            value={briefStats.actions.toString()}
            sub="Across 4 agents"
          />
          <StatCard
            icon={<CheckCheck size={16} />}
            tone="success"
            label="Auto-handled"
            value={briefStats.autoHandled.toString()}
            sub="Overnight, while you slept"
          />
          <StatCard
            icon={<Wallet size={16} />}
            tone="violet"
            label="Collected this week"
            value={formatCurrency(briefStats.collectedThisWeek)}
            sub={`${briefStats.trackedThisWeek}h tracked`}
          />
        </div>

        {/* Two-column main */}
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <SectionHeader
              title="Top proposals to review"
              subtitle="Approve in one click — agents are waiting"
              right={
                <Link href="/inbox">
                  <Button variant="outline" size="sm">
                    Open Agent Inbox <ArrowUpRight size={14} />
                  </Button>
                </Link>
              }
            />
            <div className="space-y-3">
              {topProposals.map((p) => (
                <ProposalCard key={p.id} p={p} />
              ))}
            </div>
          </div>

          <div className="space-y-6">
            {/* Today's calendar */}
            <Card>
              <CardContent>
                <div className="flex items-center gap-2 mb-3">
                  <CalendarDays size={14} className="text-emerald-600" />
                  <h3 className="text-sm font-semibold text-ink-900">Today</h3>
                  <span className="ml-auto text-[11px] text-ink-400">4 events</span>
                </div>
                <ul className="space-y-3">
                  {todayCalendar.map((ev) => (
                    <li key={ev.title} className="flex gap-3 items-start">
                      <div className="w-16 shrink-0 text-[11px] font-medium text-ink-700 pt-0.5">
                        {ev.time}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-ink-900 truncate">{ev.title}</div>
                        <div className="text-[11px] text-ink-500 truncate">
                          {ev.client} · {ev.duration}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Agent activity */}
            <Card>
              <CardContent>
                <div className="flex items-center gap-2 mb-3">
                  <Clock4 size={14} className="text-flow-600" />
                  <h3 className="text-sm font-semibold text-ink-900">Agent activity</h3>
                  <span className="ml-auto text-[11px] text-ink-400">last 24h</span>
                </div>
                <ul className="space-y-3">
                  {recentActivity.map((a) => {
                    const c = clients.find((x) => x.id === a.clientId);
                    return (
                      <li key={a.id} className="flex gap-3">
                        <AgentIcon k={a.agent} size={28} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] text-ink-800 leading-snug">{a.text}</p>
                          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-500">
                            {c && <span>{c.name}</span>}
                            <span>·</span>
                            <span>{relTime(a.at)}</span>
                            {a.result === "auto" && <Badge tone="success">auto</Badge>}
                            {a.result === "approved" && <Badge tone="flow">approved</Badge>}
                            {a.result === "edited" && <Badge tone="warn">edited</Badge>}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>

            {/* Agent overview */}
            <Card>
              <CardContent>
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-sm font-semibold text-ink-900">Your agent mesh</h3>
                  <Badge tone="success">all healthy</Badge>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(["inbox", "calendar", "ar", "report", "health", "time"] as const).map((k) => (
                    <div key={k} className="rounded-lg border border-ink-100 p-2 flex flex-col items-center gap-1">
                      <AgentIcon k={k} size={28} />
                      <span className="text-[10px] text-ink-500 text-center leading-tight">
                        {k === "ar" ? "AR" : k === "report" ? "Report" : k === "calendar" ? "Calendar" : k === "inbox" ? "Inbox" : k === "health" ? "Health" : "Time"}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}

function StatCard({
  icon,
  tone,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  tone: "flow" | "warn" | "success" | "violet";
  label: string;
  value: string;
  sub: string;
}) {
  const toneCls: Record<typeof tone, string> = {
    flow: "bg-flow-50 text-flow-700",
    warn: "bg-amber-50 text-amber-700",
    success: "bg-emerald-50 text-emerald-700",
    violet: "bg-violet-50 text-violet-700",
  };
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-ink-500">
          <span className={`size-7 rounded-lg grid place-items-center ${toneCls[tone]}`}>{icon}</span>
          <span>{label}</span>
        </div>
        <div className="mt-2 text-2xl font-semibold text-ink-900">{value}</div>
        <div className="text-[11px] text-ink-500 mt-0.5">{sub}</div>
      </CardContent>
    </Card>
  );
}

function SectionHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <h2 className="text-base font-semibold text-ink-900">{title}</h2>
        {subtitle && <p className="text-xs text-ink-500 mt-0.5">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}
