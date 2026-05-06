import Link from "next/link";
import {
  Activity,
  Bell,
  Clock,
  Filter,
  Hand,
  Pause,
  Sparkles,
  Webhook as WebhookIcon,
  Layers,
  TrendingUp,
} from "lucide-react";
import { Topbar } from "@/components/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AgentIcon } from "@/components/agent-icon";
import { ServiceIcon } from "@/components/service-icon";
import { AutomationBuilder } from "@/components/automation-builder";
import {
  automations,
  automationTemplates,
  tierAutomationLimits,
  type Automation,
  type FlowStep,
} from "@/lib/automations";
import { relTime } from "@/lib/utils";

const currentTier = "Pro" as const;

export default function AutomationsPage() {
  const active = automations.filter((a) => a.status === "active");
  const limit = tierAutomationLimits[currentTier];
  const limitLabel = limit === Infinity ? "unlimited" : `${active.length}/${limit}`;

  return (
    <>
      <Topbar
        title="Automations"
        subtitle={`Natural-language workflow builder · ${active.length} active · ${currentTier} plan limit: ${limitLabel}`}
      />

      <div className="p-6 max-w-[1200px] space-y-6">
        {/* Tier limit banner */}
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <span className="size-10 rounded-xl bg-flow-50 text-flow-700 grid place-items-center">
              <Layers size={18} />
            </span>
            <div className="flex-1">
              <div className="text-sm font-semibold text-ink-900">
                {active.length} of {limit === Infinity ? "∞" : limit} active automations on {currentTier}
              </div>
              <p className="text-xs text-ink-500 mt-0.5">
                Free includes 3, Pro includes 20, Agency is unlimited. Each workspace maps to its own isolated Activepieces project.
              </p>
            </div>
            <div className="w-40 h-2 rounded-full bg-ink-100 overflow-hidden">
              <div
                className="h-full bg-flow-600 rounded-full"
                style={{
                  width: `${
                    limit === Infinity ? 100 : Math.min(100, Math.round((active.length / (limit as number)) * 100))
                  }%`,
                }}
              />
            </div>
            <Link href="/settings">
              <Button variant="outline" size="sm">
                Compare plans
              </Button>
            </Link>
          </CardContent>
        </Card>

        <AutomationBuilder />

        {/* Active automations */}
        <section>
          <SectionHeader
            title="Your automations"
            subtitle={`${automations.length} total · ${active.length} active · ${automations.filter((a) => a.status === "paused").length} paused`}
            right={
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  Sort: most recent
                </Button>
                <Button variant="outline" size="sm">
                  Filter
                </Button>
              </div>
            }
          />
          <div className="grid md:grid-cols-2 gap-4">
            {automations.map((a) => (
              <AutomationCard key={a.id} a={a} />
            ))}
          </div>
        </section>

        {/* Templates */}
        <section>
          <SectionHeader
            title="Templates"
            subtitle="One-click installs, pre-validated for your workspace"
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {automationTemplates.map((t) => (
              <Card key={t.id}>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge tone="flow">{t.category}</Badge>
                    {t.popular && <Badge tone="warn">popular</Badge>}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-ink-900">{t.name}</h3>
                    <p className="text-xs text-ink-600 mt-1">{t.description}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-ink-100">
                    <TriggerMini kind={t.trigger.kind} />
                    {t.steps.slice(0, 4).map((s) => (
                      <StepMini key={s.id} step={s} />
                    ))}
                    {t.steps.length > 4 && (
                      <span className="text-[11px] text-ink-500">+{t.steps.length - 4}</span>
                    )}
                  </div>
                  <Button variant="outline" size="sm" className="w-full">
                    Install template
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* V2 stack callout */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <span className="size-9 rounded-xl bg-gradient-to-br from-flow-500 to-violet-500 grid place-items-center text-white">
                <Sparkles size={16} />
              </span>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-ink-900">
                  Powered by Flow OS V2 — open-source infrastructure
                </h3>
                <p className="text-xs text-ink-600 mt-1">
                  Automations run on Activepieces (MIT) with workspace-scoped projects. The NL builder
                  uses a Vercel AI SDK structured-output translator backed by your chosen LLM provider.
                  Failed runs surface in your Agent Inbox with full step traces.
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {["Activepieces", "Qdrant", "Mem0", "LiteLLM", "Temporal", "Novu", "PostHog"].map(
                    (t) => (
                      <span
                        key={t}
                        className="text-[10px] rounded bg-ink-100 px-1.5 py-0.5 text-ink-700"
                      >
                        {t}
                      </span>
                    )
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
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
    <div className="flex items-end gap-3 mb-3">
      <div className="flex-1">
        <h2 className="text-base font-semibold text-ink-900">{title}</h2>
        {subtitle && <p className="text-xs text-ink-500">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

function AutomationCard({ a }: { a: Automation }) {
  const successRate = a.runs.total > 0 ? Math.round((a.runs.success / a.runs.total) * 100) : 100;
  return (
    <Link href={`/automations/${a.id}`}>
      <Card className="h-full hover:shadow-card transition-shadow">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-start gap-3">
            <span className="size-9 rounded-xl bg-flow-50 text-flow-700 grid place-items-center shrink-0">
              <Activity size={16} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-ink-900">{a.name}</h3>
                <StatusBadge status={a.status} />
                {a.source === "natural_language" && <Badge tone="violet">NL</Badge>}
                {a.source === "template" && <Badge>template</Badge>}
              </div>
              <p className="text-xs text-ink-600 mt-1 line-clamp-2">{a.description}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <TriggerMini kind={a.trigger.kind} />
            {a.steps.slice(0, 5).map((s) => (
              <StepMini key={s.id} step={s} />
            ))}
            {a.steps.length > 5 && (
              <span className="text-[11px] text-ink-500">+{a.steps.length - 5}</span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-ink-100 text-center">
            <div>
              <div className="text-xs font-semibold text-ink-900 flex items-center justify-center gap-1">
                <TrendingUp size={11} className="text-emerald-600" />
                {successRate}%
              </div>
              <div className="text-[10px] text-ink-500">success</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-ink-900">{a.runs.total}</div>
              <div className="text-[10px] text-ink-500">total runs</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-ink-900">
                {a.lastRun ? relTime(a.lastRun.at) : "—"}
              </div>
              <div className="text-[10px] text-ink-500">last run</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function StatusBadge({ status }: { status: Automation["status"] }) {
  if (status === "active") return <Badge tone="success">active</Badge>;
  if (status === "paused") return <Badge tone="warn">paused</Badge>;
  if (status === "draft") return <Badge>draft</Badge>;
  return <Badge tone="danger">error</Badge>;
}

function TriggerMini({ kind }: { kind: "agent_signal" | "schedule" | "webhook" | "manual" }) {
  const icon =
    kind === "agent_signal" ? <Bell size={12} /> :
    kind === "schedule" ? <Clock size={12} /> :
    kind === "webhook" ? <WebhookIcon size={12} /> :
    <Hand size={12} />;
  const tone =
    kind === "agent_signal" ? "bg-flow-50 text-flow-700 ring-flow-200" :
    kind === "schedule" ? "bg-amber-50 text-amber-700 ring-amber-200" :
    kind === "webhook" ? "bg-violet-50 text-violet-700 ring-violet-200" :
    "bg-ink-100 text-ink-700 ring-ink-200";
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-medium ring-1 ${tone}`}>
      {icon}
      {kind.replace("_", " ")}
    </span>
  );
}

function StepMini({ step }: { step: FlowStep }) {
  if (step.kind === "agent") return <AgentIcon k={step.agent} size={22} />;
  if (step.kind === "service") return <ServiceIcon s={step.service} size={22} />;
  if (step.kind === "condition") {
    return (
      <span className="size-[22px] rounded-md ring-1 ring-ink-200 bg-ink-100 grid place-items-center text-ink-700">
        <Filter size={12} />
      </span>
    );
  }
  return (
    <span className="size-[22px] rounded-md ring-1 ring-ink-200 bg-ink-100 grid place-items-center text-ink-700">
      <Pause size={12} />
    </span>
  );
}
