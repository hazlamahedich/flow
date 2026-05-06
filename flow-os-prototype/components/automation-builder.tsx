"use client";

import { useState } from "react";
import { Sparkles, ArrowRight, Pencil, Wand2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FlowGraph } from "@/components/flow-graph";
import { generateFlowFromPrompt, type GeneratedFlow } from "@/lib/automations";

const samplePrompts = [
  "When a client invoice goes overdue, draft a follow-up and ping me on Slack if no reply in 3 days",
  "Every Friday at 4pm send a weekly summary to each client through the portal",
  "When a new client is created, send a welcome email and set up their Notion page and Trello board",
  "Every Monday flag clients with health scores below 50 and DM me on Slack",
];

export function AutomationBuilder() {
  const [prompt, setPrompt] = useState("");
  const [phase, setPhase] = useState<"idle" | "generating" | "preview">("idle");
  const [flow, setFlow] = useState<GeneratedFlow | null>(null);
  const [activated, setActivated] = useState(false);

  const onGenerate = (fromPrompt?: string) => {
    const p = (fromPrompt ?? prompt).trim();
    if (!p) return;
    if (fromPrompt) setPrompt(fromPrompt);
    setPhase("generating");
    setActivated(false);
    // Simulate streaming
    setTimeout(() => {
      setFlow(generateFlowFromPrompt(p));
      setPhase("preview");
    }, 900);
  };

  const reset = () => {
    setPhase("idle");
    setFlow(null);
    setPrompt("");
    setActivated(false);
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="bg-gradient-to-br from-flow-50 via-white to-violet-50 px-6 py-5 border-b border-ink-100">
          <div className="flex items-center gap-2">
            <span className="size-7 rounded-lg bg-gradient-to-br from-flow-500 to-violet-500 grid place-items-center text-white">
              <Wand2 size={14} />
            </span>
            <h2 className="text-base font-semibold text-ink-900">Automation Builder</h2>
            <Badge tone="flow">V2</Badge>
            <span className="ml-auto text-[11px] text-ink-500">
              Powered by LLM → Activepieces (MIT)
            </span>
          </div>
          <p className="text-xs text-ink-600 mt-1">
            Type what you want to happen. Flow OS translates it into a working automation — no drag-and-drop, no code.
          </p>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-start gap-2">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder="e.g. When a client invoice goes overdue, draft a follow-up email and Slack me if there's no reply in 3 days…"
              className="flex-1 rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-flow-400"
            />
            <Button
              variant="accent"
              size="lg"
              onClick={() => onGenerate()}
              disabled={!prompt.trim() || phase === "generating"}
            >
              {phase === "generating" ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              Generate
            </Button>
          </div>

          {phase === "idle" && (
            <div>
              <p className="text-[11px] uppercase tracking-wider text-ink-500 font-semibold mb-2">
                Try a sample
              </p>
              <div className="flex flex-wrap gap-2">
                {samplePrompts.map((s) => (
                  <button
                    key={s}
                    onClick={() => onGenerate(s)}
                    className="text-xs rounded-full border border-ink-200 bg-white px-3 py-1.5 text-ink-700 hover:bg-ink-100 hover:border-ink-300"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {phase === "generating" && (
            <div className="rounded-xl border border-dashed border-flow-200 bg-flow-50/40 p-6 text-center">
              <Loader2 size={18} className="mx-auto animate-spin text-flow-600" />
              <p className="text-sm text-ink-700 mt-2">
                Translating your description into an Activepieces flow…
              </p>
              <p className="text-[11px] text-ink-500 mt-1">
                Validating against allowed pieces · checking workspace permissions
              </p>
            </div>
          )}

          {phase === "preview" && flow && (
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 flex items-center gap-3">
                <Sparkles size={16} className="text-emerald-700" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-ink-900">{flow.name}</div>
                  <div className="text-[11px] text-ink-600">{flow.description}</div>
                </div>
                <Badge tone="success">draft</Badge>
              </div>

              <div className="rounded-xl border border-ink-100 bg-ink-50/40 p-4">
                <FlowGraph trigger={flow.trigger} steps={flow.steps} />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {!activated ? (
                  <>
                    <Button variant="success" size="md" onClick={() => setActivated(true)}>
                      Activate flow
                    </Button>
                    <Button variant="outline" size="md">
                      <Pencil size={14} /> Refine in builder
                    </Button>
                  </>
                ) : (
                  <span className="inline-flex items-center gap-2 text-sm text-emerald-700 font-medium">
                    ✓ Activated — your automation is live
                  </span>
                )}
                <Button variant="ghost" size="md" onClick={reset}>
                  Start over <ArrowRight size={14} />
                </Button>
                <span className="ml-auto text-[11px] text-ink-500">
                  Flow runs scoped to <code className="text-ink-700">workspace_id</code> — Activepieces project isolation
                </span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
