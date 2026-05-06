import { notFound } from "next/navigation";
import { Topbar } from "@/components/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AgentIcon } from "@/components/agent-icon";
import {
  clients,
  tasks,
  invoices,
  timeEntries,
  recentActivity,
} from "@/lib/mock-data";
import { formatCurrency, relTime } from "@/lib/utils";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = clients.find((c) => c.id === id);
  if (!client) return notFound();

  const myTasks = tasks.filter((t) => t.clientId === id);
  const myInvoices = invoices.filter((i) => i.clientId === id);
  const myTime = timeEntries.filter((t) => t.clientId === id);
  const myActivity = recentActivity.filter((a) => a.clientId === id);

  return (
    <>
      <Topbar title={client.name} subtitle={`${client.contact} · ${client.email}`} />

      <div className="p-6 max-w-[1200px] grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Header strip */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <Avatar name={client.name} size={56} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-semibold text-ink-900">{client.name}</h2>
                    <Badge
                      tone={
                        client.status === "healthy"
                          ? "success"
                          : client.status === "at-risk"
                          ? "warn"
                          : client.status === "stalled"
                          ? "danger"
                          : "flow"
                      }
                    >
                      {client.status}
                    </Badge>
                    {client.tags?.map((t) => <Badge key={t}>{t}</Badge>)}
                  </div>
                  <p className="text-sm text-ink-600 mt-1">
                    Last activity {relTime(client.lastActivity)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">Open portal</Button>
                  <Button variant="primary" size="sm">New invoice</Button>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4 mt-5">
                <Stat label="Health" value={`${client.health}/100`} />
                <Stat label="MRR" value={formatCurrency(client.mrr)} />
                <Stat label="This week" value={`${client.hoursThisWeek}h`} />
                <Stat
                  label="Outstanding AR"
                  value={formatCurrency(client.outstandingAR)}
                  warn={client.outstandingAR > 0}
                />
              </div>
              <div className="mt-3">
                <div className="flex items-center justify-between text-[11px] text-ink-500 mb-1">
                  <span>Health trend</span>
                  <span>30d</span>
                </div>
                <Progress
                  value={client.health}
                  barClassName={client.health >= 75 ? "bg-emerald-500" : client.health >= 55 ? "bg-amber-500" : "bg-red-500"}
                />
              </div>
            </CardContent>
          </Card>

          {/* Tasks */}
          <Card>
            <CardContent>
              <SectionHeader title="Tasks" sub={`${myTasks.length} total`} />
              <ul className="divide-y divide-ink-100">
                {myTasks.length === 0 && (
                  <li className="text-xs text-ink-500 py-3">No tasks yet for this client.</li>
                )}
                {myTasks.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 py-3">
                    <div
                      className={`size-2 rounded-full ${
                        t.status === "done"
                          ? "bg-emerald-500"
                          : t.status === "review"
                          ? "bg-amber-500"
                          : t.status === "doing"
                          ? "bg-flow-500"
                          : "bg-ink-300"
                      }`}
                    />
                    <span className="flex-1 text-sm text-ink-900">{t.title}</span>
                    {t.agentSource && <AgentIcon k={t.agentSource} size={20} />}
                    {t.due && <Badge>{t.due}</Badge>}
                    <Badge>{t.status}</Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Invoices */}
          <Card>
            <CardContent>
              <SectionHeader title="Invoices" sub={`${myInvoices.length} total`} />
              <table className="w-full text-sm">
                <thead className="text-[11px] uppercase tracking-wide text-ink-500">
                  <tr className="text-left">
                    <th className="font-medium py-2">Number</th>
                    <th className="font-medium">Amount</th>
                    <th className="font-medium">Status</th>
                    <th className="font-medium">Due</th>
                  </tr>
                </thead>
                <tbody>
                  {myInvoices.map((i) => (
                    <tr key={i.id} className="border-t border-ink-100">
                      <td className="py-2.5 font-medium text-ink-900">{i.number}</td>
                      <td>{formatCurrency(i.amount)}</td>
                      <td>
                        <Badge
                          tone={
                            i.status === "paid"
                              ? "success"
                              : i.status === "overdue"
                              ? "danger"
                              : i.status === "sent"
                              ? "flow"
                              : "neutral"
                          }
                        >
                          {i.status}
                          {i.daysOverdue ? ` ${i.daysOverdue}d` : ""}
                        </Badge>
                      </td>
                      <td className="text-ink-600">{i.due ?? "—"}</td>
                    </tr>
                  ))}
                  {myInvoices.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-3 text-xs text-ink-500">
                        No invoices yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {/* Agent activity */}
          <Card>
            <CardContent>
              <SectionHeader title="Agent activity" sub="Last 7 days" />
              <ul className="space-y-3">
                {myActivity.length === 0 && (
                  <li className="text-xs text-ink-500">No agent activity yet.</li>
                )}
                {myActivity.map((a) => (
                  <li key={a.id} className="flex gap-2">
                    <AgentIcon k={a.agent} size={24} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-ink-800 leading-snug">{a.text}</p>
                      <p className="text-[11px] text-ink-500">{relTime(a.at)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Time */}
          <Card>
            <CardContent>
              <SectionHeader title="Time entries" sub="Today" />
              <ul className="space-y-3">
                {myTime.length === 0 && (
                  <li className="text-xs text-ink-500">No time logged today.</li>
                )}
                {myTime.map((t) => (
                  <li key={t.id} className="text-xs">
                    <div className="text-ink-900 font-medium">{t.description}</div>
                    <div className="text-ink-500">
                      {t.durationMin}m · {t.billable ? "Billable" : "Non-billable"}
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-ink-500 font-medium">{label}</div>
      <div className={`text-lg font-semibold ${warn ? "text-red-600" : "text-ink-900"}`}>{value}</div>
    </div>
  );
}

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
      {sub && <span className="text-[11px] text-ink-400">{sub}</span>}
    </div>
  );
}
