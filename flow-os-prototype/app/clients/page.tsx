import Link from "next/link";
import { Topbar } from "@/components/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { clients } from "@/lib/mock-data";
import { formatCurrency, relTime } from "@/lib/utils";

const statusTone = {
  healthy: "success",
  "at-risk": "warn",
  stalled: "danger",
  new: "flow",
} as const;

export default function ClientsPage() {
  return (
    <>
      <Topbar title="Clients" subtitle={`${clients.length} clients · 6 healthy · 2 at risk · 1 stalled`} />
      <div className="p-6 max-w-[1200px]">
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {clients.map((c) => (
            <Link key={c.id} href={`/clients/${c.id}`}>
              <Card className="hover:shadow-card transition-shadow h-full">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <Avatar name={c.name} size={40} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-ink-900 truncate">{c.name}</h3>
                        <Badge tone={statusTone[c.status]}>{c.status}</Badge>
                      </div>
                      <p className="text-[11px] text-ink-500 truncate">{c.contact} · {c.email}</p>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-[11px] text-ink-500 mb-1">
                      <span>Client health</span>
                      <span className="font-medium text-ink-700">{c.health}/100</span>
                    </div>
                    <Progress
                      value={c.health}
                      barClassName={
                        c.health >= 75 ? "bg-emerald-500" : c.health >= 55 ? "bg-amber-500" : "bg-red-500"
                      }
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-sm font-semibold text-ink-900">{formatCurrency(c.mrr)}</div>
                      <div className="text-[10px] text-ink-500">MRR</div>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-ink-900">{c.hoursThisWeek}h</div>
                      <div className="text-[10px] text-ink-500">This week</div>
                    </div>
                    <div>
                      <div className={`text-sm font-semibold ${c.outstandingAR > 0 ? "text-red-600" : "text-ink-900"}`}>
                        {formatCurrency(c.outstandingAR)}
                      </div>
                      <div className="text-[10px] text-ink-500">Outstanding</div>
                    </div>
                  </div>

                  {c.nextAction && (
                    <div className="rounded-lg bg-ink-50 border border-ink-100 p-2.5">
                      <div className="text-[10px] uppercase tracking-wide text-ink-500 font-medium">Next</div>
                      <div className="text-xs text-ink-800">{c.nextAction}</div>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-ink-400">
                    <span>Last activity {relTime(c.lastActivity)}</span>
                    <div className="flex gap-1">
                      {c.tags?.map((t) => (
                        <span key={t} className="px-1.5 py-0.5 rounded bg-ink-100 text-ink-600">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
