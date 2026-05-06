"use client";

import { useMemo, useState } from "react";
import { Topbar } from "@/components/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProposalCard } from "@/components/proposal-card";
import { AgentIcon, type AgentKey, agentLabel } from "@/components/agent-icon";
import { agentInbox, agentTrust, trustLabels } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const filters: { k: AgentKey | "all"; label: string }[] = [
  { k: "all", label: "All agents" },
  { k: "inbox", label: "Inbox" },
  { k: "calendar", label: "Calendar" },
  { k: "ar", label: "AR Collection" },
  { k: "report", label: "Weekly Report" },
  { k: "time", label: "Time Integrity" },
  { k: "health", label: "Client Health" },
];

export default function AgentInboxPage() {
  const [selected, setSelected] = useState<AgentKey | "all">("all");

  const visible = useMemo(
    () => agentInbox.filter((p) => selected === "all" || p.agent === selected),
    [selected]
  );

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: agentInbox.length };
    for (const a of agentInbox) map[a.agent] = (map[a.agent] ?? 0) + 1;
    return map;
  }, []);

  return (
    <>
      <Topbar
        title="Agent Inbox"
        subtitle={`${visible.length} pending proposal${visible.length === 1 ? "" : "s"} · approve, edit, or reject — every action is logged for trust progression`}
      />

      <div className="p-6 grid lg:grid-cols-[260px_1fr] gap-6 max-w-[1200px]">
        {/* Filters + trust panel */}
        <aside className="space-y-4">
          <Card>
            <CardContent className="p-3">
              <div className="px-2 py-1 text-[11px] uppercase tracking-wide text-ink-500 font-medium">
                Filter
              </div>
              <ul className="space-y-0.5">
                {filters.map((f) => {
                  const active = selected === f.k;
                  const count = counts[f.k] ?? 0;
                  return (
                    <li key={f.k}>
                      <button
                        onClick={() => setSelected(f.k)}
                        className={cn(
                          "w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                          active ? "bg-ink-900 text-white" : "text-ink-700 hover:bg-ink-100"
                        )}
                      >
                        {f.k !== "all" && <AgentIcon k={f.k} size={20} />}
                        <span className="flex-1 text-left">{f.label}</span>
                        <span
                          className={cn(
                            "text-[11px] rounded-full px-1.5",
                            active ? "bg-white/15 text-white" : "bg-ink-100 text-ink-600"
                          )}
                        >
                          {count}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-ink-900">Trust progression</h3>
                <p className="text-[11px] text-ink-500 mt-0.5">
                  Agents earn autonomy through clean approvals.
                </p>
              </div>
              <ul className="space-y-2.5">
                {agentTrust.map((t) => (
                  <li key={t.k} className="text-xs">
                    <div className="flex items-center gap-2">
                      <AgentIcon k={t.k} size={20} />
                      <span className="font-medium text-ink-800">{agentLabel(t.k)}</span>
                      <Badge tone={t.level >= 2 ? "success" : t.level === 1 ? "flow" : "neutral"}>
                        L{t.level}
                      </Badge>
                    </div>
                    <div className="mt-1 text-[11px] text-ink-500">
                      {Math.round(t.cleanRate * 100)}% clean · {Math.round(t.editRate * 100)}% edit
                      · {Math.round(t.rejectRate * 100)}% reject
                    </div>
                    <div className="mt-1 h-1 w-full rounded-full bg-ink-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${Math.round(t.cleanRate * 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-ink-500 leading-relaxed">
                Levels: {Object.entries(trustLabels).map(([k, v]) => `L${k} ${v}`).join(" · ")}
              </p>
            </CardContent>
          </Card>
        </aside>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-ink-500">
              5% of approved runs are sampled weekly for human QA review.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">Sort: newest</Button>
              <Button variant="ghost" size="sm">Mark all reviewed</Button>
            </div>
          </div>
          {visible.length === 0 ? (
            <Card>
              <CardContent className="p-10 text-center">
                <p className="text-sm text-ink-600">No proposals from this agent right now.</p>
                <p className="text-xs text-ink-400 mt-1">
                  Agents work continuously in the background.
                </p>
              </CardContent>
            </Card>
          ) : (
            visible.map((p) => <ProposalCard key={p.id} p={p} />)
          )}
        </div>
      </div>
    </>
  );
}
