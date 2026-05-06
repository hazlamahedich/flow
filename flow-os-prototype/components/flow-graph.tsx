import {
  Webhook as WebhookIcon,
  Clock as ClockIcon,
  Bell,
  Hand,
  GitBranch,
  Pause as PauseIcon,
} from "lucide-react";
import { AgentIcon, agentLabel } from "@/components/agent-icon";
import { ServiceIcon, serviceLabel } from "@/components/service-icon";
import { Badge } from "@/components/ui/badge";
import type { FlowStep, FlowTrigger } from "@/lib/automations";

export function FlowGraph({
  trigger,
  steps,
  compact = false,
}: {
  trigger: FlowTrigger;
  steps: FlowStep[];
  compact?: boolean;
}) {
  return (
    <div className="space-y-0">
      <TriggerCard trigger={trigger} compact={compact} />
      <Connector />
      {steps.map((step, idx) => (
        <div key={step.id}>
          <StepCard step={step} compact={compact} />
          {idx < steps.length - 1 && <Connector />}
        </div>
      ))}
    </div>
  );
}

function Connector() {
  return (
    <div className="flex justify-center">
      <div className="w-px h-5 bg-ink-200" />
    </div>
  );
}

function TriggerCard({ trigger, compact }: { trigger: FlowTrigger; compact: boolean }) {
  const triggerIcon = (() => {
    switch (trigger.kind) {
      case "agent_signal":
        return <Bell size={14} />;
      case "schedule":
        return <ClockIcon size={14} />;
      case "webhook":
        return <WebhookIcon size={14} />;
      default:
        return <Hand size={14} />;
    }
  })();
  const tone =
    trigger.kind === "agent_signal"
      ? "bg-flow-50 text-flow-700 ring-flow-200"
      : trigger.kind === "schedule"
      ? "bg-amber-50 text-amber-700 ring-amber-200"
      : trigger.kind === "webhook"
      ? "bg-violet-50 text-violet-700 ring-violet-200"
      : "bg-ink-100 text-ink-700 ring-ink-200";
  return (
    <div className={`rounded-xl border border-ink-100 bg-white shadow-soft p-3 ${compact ? "" : "p-4"}`}>
      <div className="flex items-start gap-3">
        <span className={`size-9 rounded-lg ring-1 grid place-items-center ${tone}`}>
          {triggerIcon}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-ink-500">
              When
            </span>
            <Badge tone={trigger.kind === "agent_signal" ? "flow" : trigger.kind === "schedule" ? "warn" : trigger.kind === "webhook" ? "violet" : "neutral"}>
              {trigger.kind.replace("_", " ")}
            </Badge>
          </div>
          <div className="text-sm font-semibold text-ink-900 mt-0.5">{trigger.label}</div>
          {trigger.detail && (
            <div className="text-[11px] text-ink-500 mt-0.5">{trigger.detail}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function StepCard({ step, compact }: { step: FlowStep; compact: boolean }) {
  const verb =
    step.kind === "agent" ? "Run agent" :
    step.kind === "service" ? "Then" :
    step.kind === "condition" ? "Only if" :
    "Wait";

  let icon: React.ReactNode;
  let title = step.label;
  let detail = step.detail;
  let chip: React.ReactNode = null;

  if (step.kind === "agent") {
    icon = <AgentIcon k={step.agent} size={36} />;
    chip = <Badge tone="violet">{agentLabel(step.agent)}</Badge>;
  } else if (step.kind === "service") {
    icon = <ServiceIcon s={step.service} size={36} />;
    chip = <Badge>{serviceLabel(step.service)}</Badge>;
  } else if (step.kind === "condition") {
    icon = (
      <span className="size-9 rounded-lg ring-1 ring-ink-200 bg-ink-100 text-ink-700 grid place-items-center">
        <GitBranch size={16} />
      </span>
    );
    chip = <Badge>condition</Badge>;
  } else {
    icon = (
      <span className="size-9 rounded-lg ring-1 ring-ink-200 bg-ink-100 text-ink-700 grid place-items-center">
        <PauseIcon size={16} />
      </span>
    );
    chip = <Badge>delay</Badge>;
  }

  return (
    <div className={`rounded-xl border border-ink-100 bg-white shadow-soft p-3 ${compact ? "" : "p-4"}`}>
      <div className="flex items-start gap-3">
        {icon}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-ink-500">
              {verb}
            </span>
            {chip}
          </div>
          <div className="text-sm font-semibold text-ink-900 mt-0.5">{title}</div>
          {detail && <div className="text-[11px] text-ink-500 mt-0.5">{detail}</div>}
        </div>
      </div>
    </div>
  );
}
