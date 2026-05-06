import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Pause,
  Play,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Activity,
  Sparkles,
  Code,
} from "lucide-react";
import { Topbar } from "@/components/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FlowGraph } from "@/components/flow-graph";
import { automations, executions } from "@/lib/automations";
import { relTime } from "@/lib/utils";

export default async function AutomationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const a = automations.find((x) => x.id === id);
  if (!a) return notFound();

  const myExec = executions.filter((e) => e.automationId === id);
  const successRate = a.runs.total > 0 ? Math.round((a.runs.success / a.runs.total) * 100) : 100;

  return (
    <>
      <Topbar title={a.name} subtitle={a.description} />

      <div className="p-6 max-w-[1200px] grid lg:grid-cols-[1fr_320px] gap-6">
        {/* Left: flow + history */}
        <div className="space-y-6">
          <Link
            href="/automations"
            className="inline-flex items-center gap-1 text-xs text-ink-500 hover:text-ink-800"
          >
            <ArrowLeft size={12} /> All automations
          </Link>

          {/* Flow visual */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-sm font-semibold text-ink-900">Flow definition</h3>
                <Badge
                  tone={
                    a.status === "active"
                      ? "success"
                      : a.status === "paused"
                      ? "warn"
                      : a.status === "draft"
                      ? "neutral"
                      : "danger"
                  }
                >
                  {a.status}
                </Badge>
                <span className="ml-auto text-[11px] text-ink-500">
                  {a.steps.length} step{a.steps.length === 1 ? "" : "s"}
                </span>
              </div>
              <FlowGraph trigger={a.trigger} steps={a.steps} />
            </CardContent>
          </Card>

          {/* Source — NL prompt */}
          {a.prompt && (
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={14} className="text-flow-600" />
                  <h3 className="text-sm font-semibold text-ink-900">
                    Original natural-language prompt
                  </h3>
                </div>
                <blockquote className="text-sm text-ink-700 italic border-l-2 border-flow-300 pl-3">
                  "{a.prompt}"
                </blockquote>
                <p className="text-[11px] text-ink-500 mt-2">
                  Translated by the Automation Builder · validated against allowed pieces · created{" "}
                  {a.createdAt}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Executions */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Activity size={14} className="text-ink-500" />
                  <h3 className="text-sm font-semibold text-ink-900">Execution history</h3>
                </div>
                <span className="text-[11px] text-ink-500">last {myExec.length} runs</span>
              </div>
              {myExec.length === 0 ? (
                <p className="text-xs text-ink-500 text-center py-6">
                  No runs yet — this automation hasn't been triggered.
                </p>
              ) : (
                <ul className="divide-y divide-ink-100">
                  {myExec.map((e) => (
                    <li key={e.id} className="py-3">
                      <div className="flex items-center gap-3">
                        {e.status === "success" ? (
                          <CheckCircle2 size={16} className="text-emerald-600" />
                        ) : e.status === "failed" ? (
                          <XCircle size={16} className="text-red-600" />
                        ) : (
                          <Activity size={16} className="text-flow-600 animate-pulse" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-ink-900">{e.trigger}</div>
                          <div className="text-[11px] text-ink-500">
                            {relTime(e.startedAt)} · {(e.durationMs / 1000).toFixed(1)}s ·{" "}
                            {e.steps.length} steps · {e.steps.filter((s) => s.status === "ok").length}{" "}
                            ok / {e.steps.filter((s) => s.status === "skipped").length} skipped /{" "}
                            {e.steps.filter((s) => s.status === "failed").length} failed
                          </div>
                          {e.errorMessage && (
                            <div className="mt-1 text-[11px] text-red-700 flex items-start gap-1">
                              <AlertTriangle size={11} className="mt-0.5 shrink-0" />
                              <span>{e.errorMessage}</span>
                            </div>
                          )}
                        </div>
                        <Badge tone={e.status === "success" ? "success" : e.status === "failed" ? "danger" : "flow"}>
                          {e.status}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: side panel */}
        <aside className="space-y-4">
          <Card>
            <CardContent className="p-5 space-y-3">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-ink-500 font-semibold">
                  Status
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <Badge
                    tone={
                      a.status === "active"
                        ? "success"
                        : a.status === "paused"
                        ? "warn"
                        : a.status === "draft"
                        ? "neutral"
                        : "danger"
                    }
                  >
                    {a.status}
                  </Badge>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center pt-3 border-t border-ink-100">
                <Stat label="Success" value={`${successRate}%`} />
                <Stat label="Runs" value={a.runs.total.toString()} />
                <Stat
                  label="Failed"
                  value={a.runs.failed.toString()}
                  tone={a.runs.failed > 0 ? "warn" : undefined}
                />
              </div>
              <div className="pt-3 border-t border-ink-100 flex flex-col gap-2">
                {a.status === "active" ? (
                  <Button variant="outline" size="md">
                    <Pause size={14} /> Pause
                  </Button>
                ) : (
                  <Button variant="success" size="md">
                    <Play size={14} /> Activate
                  </Button>
                )}
                <Button variant="outline" size="md">
                  Run once now
                </Button>
                <Button variant="ghost" size="md">
                  Open in Activepieces builder
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 space-y-2">
              <h3 className="text-sm font-semibold text-ink-900">Trigger</h3>
              <div className="text-xs">
                <div className="text-ink-700">{a.trigger.label}</div>
                <div className="text-ink-500">{a.trigger.detail}</div>
                {a.trigger.signal && (
                  <code className="mt-1 inline-block px-1.5 py-0.5 rounded bg-ink-100 text-[10px] text-ink-700">
                    {a.trigger.signal}
                  </code>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-1">
                <Code size={12} className="text-ink-500" />
                <h3 className="text-sm font-semibold text-ink-900">Tenancy</h3>
              </div>
              <ul className="space-y-1 text-[11px] text-ink-600">
                <li>· Workspace-scoped Activepieces project</li>
                <li>· Per-project API key</li>
                <li>· Failures route to Agent Inbox</li>
                <li>· Logs streamed to OpenObserve</li>
              </ul>
            </CardContent>
          </Card>
        </aside>
      </div>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <div>
      <div className={`text-sm font-semibold ${tone === "warn" ? "text-amber-700" : "text-ink-900"}`}>
        {value}
      </div>
      <div className="text-[10px] text-ink-500">{label}</div>
    </div>
  );
}
