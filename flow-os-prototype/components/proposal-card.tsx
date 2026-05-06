"use client";

import { useState } from "react";
import { Check, Pencil, X, ShieldCheck, Sparkles, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AgentChip, AgentIcon } from "@/components/agent-icon";
import { type AgentProposal, clients, trustLabels } from "@/lib/mock-data";
import { relTime } from "@/lib/utils";

export function ProposalCard({ p }: { p: AgentProposal }) {
  const [open, setOpen] = useState(false);
  const [decision, setDecision] = useState<"pending" | "approved" | "rejected" | "edited">(p.status);
  const client = clients.find((c) => c.id === p.clientId);

  const decided = decision !== "pending";

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex items-start gap-4 p-5">
          <AgentIcon k={p.agent} size={36} />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <AgentChip k={p.agent} />
              {client && (
                <Badge tone="neutral">
                  {client.name}
                </Badge>
              )}
              <Badge tone="flow">
                <ShieldCheck size={10} />
                Trust L{p.trustLevel} · {trustLabels[p.trustLevel]}
              </Badge>
              {typeof p.confidence === "number" && (
                <Badge tone="neutral">
                  <Sparkles size={10} />
                  {Math.round(p.confidence * 100)}% confident
                </Badge>
              )}
              <span className="text-[11px] text-ink-400 ml-auto">{relTime(p.createdAt)}</span>
            </div>

            <h3 className="mt-2 text-[15px] font-semibold text-ink-900">{p.title}</h3>
            <p className="text-sm text-ink-600 mt-1">{p.summary}</p>

            {(p.draftSubject || p.draftBody) && (
              <div className="mt-3 rounded-lg border border-ink-100 bg-ink-50/60 p-3">
                {p.draftSubject && (
                  <div className="text-xs">
                    <span className="text-ink-500">Subject: </span>
                    <span className="text-ink-900 font-medium">{p.draftSubject}</span>
                  </div>
                )}
                {p.draftBody && (
                  <pre className="mt-2 whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-ink-800">
                    {p.draftBody}
                  </pre>
                )}
              </div>
            )}

            <button
              onClick={() => setOpen((s) => !s)}
              className="mt-3 inline-flex items-center gap-1 text-xs text-ink-500 hover:text-ink-800"
            >
              <ChevronRight
                size={12}
                className={`transition-transform ${open ? "rotate-90" : ""}`}
              />
              {open ? "Hide" : "Show"} reasoning
            </button>

            {open && (
              <div className="mt-2 grid sm:grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg border border-ink-100 bg-white p-3">
                  <div className="text-ink-500 font-medium">Why this proposal</div>
                  <ul className="mt-1.5 space-y-1 text-ink-700 list-disc list-inside">
                    {p.rationale?.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg border border-ink-100 bg-white p-3">
                  <div className="text-ink-500 font-medium">If approved</div>
                  <p className="mt-1.5 text-ink-700">{p.willTakeAction}</p>
                  {p.signals && p.signals.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {p.signals.map((s) => (
                        <code
                          key={s}
                          className="px-1.5 py-0.5 rounded bg-ink-100 text-ink-700 text-[10px]"
                        >
                          {s}
                        </code>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 px-5 py-3 border-t border-ink-100 bg-ink-50/40">
          {decided ? (
            <span className="text-xs text-ink-500">
              {decision === "approved" && (
                <span className="text-emerald-700 font-medium">✓ Approved — agent will execute now</span>
              )}
              {decision === "rejected" && (
                <span className="text-red-700 font-medium">✕ Rejected — agent will not act</span>
              )}
              {decision === "edited" && (
                <span className="text-flow-700 font-medium">✎ Sent edits to agent</span>
              )}
            </span>
          ) : (
            <>
              <Button variant="success" size="sm" onClick={() => setDecision("approved")}>
                <Check size={14} /> Approve
              </Button>
              <Button variant="outline" size="sm" onClick={() => setDecision("edited")}>
                <Pencil size={14} /> Edit
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setDecision("rejected")}>
                <X size={14} /> Reject
              </Button>
            </>
          )}
          <span className="ml-auto text-[11px] text-ink-400">
            {p.agent === "health"
              ? "Internal — never user-facing"
              : "Will appear in client/recipient inbox"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
