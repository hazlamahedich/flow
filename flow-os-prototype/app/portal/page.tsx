"use client";

import { useState } from "react";
import { Topbar } from "@/components/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Sparkles, CheckCircle2, ExternalLink, Globe, FileText, CreditCard } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export default function PortalPreviewPage() {
  const [paid, setPaid] = useState(false);

  return (
    <>
      <Topbar
        title="Portal preview — Lumen Studio"
        subtitle="This is what your client sees at lumen.portal.flow.app · branded, magic-link auth, no account required"
      />

      <div className="p-6 max-w-[1100px]">
        <div className="rounded-2xl border border-ink-200 bg-white shadow-card overflow-hidden">
          {/* Branded portal header */}
          <div className="bg-gradient-to-br from-flow-600 via-violet-500 to-fuchsia-500 px-8 py-7 text-white">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-white/15 backdrop-blur grid place-items-center">
                <Sparkles size={18} />
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wider text-white/80">
                  Maya Reyes Studio
                </div>
                <h1 className="text-xl font-semibold mt-0.5">Welcome back, Priya</h1>
              </div>
              <div className="ml-auto flex items-center gap-2 text-xs text-white/80">
                <Globe size={12} />
                lumen.portal.flow.app
              </div>
            </div>
            <p className="mt-3 text-sm text-white/90 max-w-2xl">
              Here's everything happening with Lumen Studio this month. No login required — your link is secured with magic auth.
            </p>
          </div>

          {/* Outcome dashboard */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 px-8 -mt-5">
            <PortalStat label="Tasks delivered" value="47" trend="+9 vs March" />
            <PortalStat label="Hours saved" value="12.4" trend="vs in-house" />
            <PortalStat label="Avg response time" value="2.3h" trend="-38% vs Q1" />
            <PortalStat label="Active projects" value="3" trend="all on track" />
          </div>

          {/* Body */}
          <div className="p-8 grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Approvals */}
              <Card>
                <CardContent>
                  <div className="flex items-center gap-2 mb-4">
                    <CheckCircle2 size={14} className="text-flow-600" />
                    <h3 className="text-sm font-semibold text-ink-900">Awaiting your approval</h3>
                  </div>
                  <div className="space-y-3">
                    <ApprovalRow
                      title="Q2 brand guidelines — final draft"
                      meta="Delivered Apr 27 · 24 pages · PDF"
                    />
                    <ApprovalRow
                      title="Press release: Vector partnership"
                      meta="Delivered Apr 28 · awaiting review"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Project status */}
              <Card>
                <CardContent>
                  <h3 className="text-sm font-semibold text-ink-900 mb-3">Projects</h3>
                  <ul className="space-y-3">
                    <PortalProject name="Q2 Campaign Launch" pct={62} status="On track" tone="success" />
                    <PortalProject name="Website refresh" pct={38} status="Design review" tone="flow" />
                    <PortalProject name="Press kit revamp" pct={88} status="Ready for sign-off" tone="warn" />
                  </ul>
                </CardContent>
              </Card>

              {/* Invoice */}
              <Card>
                <CardContent>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <CreditCard size={14} className="text-ink-500" />
                      <h3 className="text-sm font-semibold text-ink-900">Open invoice</h3>
                    </div>
                    <Badge tone={paid ? "success" : "flow"}>{paid ? "paid" : "due May 9"}</Badge>
                  </div>
                  <div className="rounded-xl border border-ink-100 bg-ink-50/40 p-4 flex items-center gap-4">
                    <div className="flex-1">
                      <div className="text-xs text-ink-500">INV-1059</div>
                      <div className="text-2xl font-semibold text-ink-900">{formatCurrency(2400)}</div>
                      <div className="text-[11px] text-ink-500 mt-1">Lumen Studio · April retainer</div>
                    </div>
                    <Button
                      variant={paid ? "outline" : "accent"}
                      size="lg"
                      onClick={() => setPaid(true)}
                      disabled={paid}
                    >
                      {paid ? "✓ Paid" : "Pay with Stripe"}
                    </Button>
                  </div>
                  <p className="text-[11px] text-ink-400 mt-2">
                    Payment processed by Stripe · receipts emailed automatically
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              {/* VA card */}
              <Card>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <Avatar name="Maya Reyes" size={44} />
                    <div>
                      <div className="text-sm font-semibold text-ink-900">Maya Reyes</div>
                      <div className="text-[11px] text-ink-500">Your operator at Reyes Studio</div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="mt-3 w-full">
                    Send a message
                  </Button>
                </CardContent>
              </Card>

              {/* Files */}
              <Card>
                <CardContent>
                  <div className="flex items-center gap-2 mb-3">
                    <FileText size={14} className="text-ink-500" />
                    <h3 className="text-sm font-semibold text-ink-900">Recent files</h3>
                  </div>
                  <ul className="space-y-2.5">
                    {[
                      { name: "Q2_brand_guidelines_v3.pdf", size: "4.2 MB" },
                      { name: "press-release-draft.docx", size: "82 KB" },
                      { name: "campaign_assets_apr.zip", size: "118 MB" },
                    ].map((f) => (
                      <li key={f.name} className="flex items-center gap-3 text-xs">
                        <FileText size={14} className="text-ink-400" />
                        <span className="flex-1 truncate text-ink-800">{f.name}</span>
                        <span className="text-ink-400">{f.size}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <div className="rounded-xl border border-ink-100 bg-ink-50 p-4">
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="text-flow-600" />
                  <div className="text-xs font-semibold text-ink-800">Powered by Flow OS</div>
                </div>
                <p className="text-[11px] text-ink-500 mt-1 leading-relaxed">
                  Get your own AI-native workspace. Refer Maya and you both get $30 credit.
                </p>
                <a className="mt-2 inline-flex items-center gap-1 text-[11px] text-flow-700 hover:underline">
                  Learn more <ExternalLink size={10} />
                </a>
              </div>
            </div>
          </div>
        </div>

        <p className="text-[11px] text-ink-400 mt-3 text-center">
          Preview only — your client's portal lives at <code className="text-ink-600">{`{slug}`}.portal.flow.app</code> with magic-link auth and your branded colors.
        </p>
      </div>
    </>
  );
}

function PortalStat({ label, value, trend }: { label: string; value: string; trend: string }) {
  return (
    <div className="rounded-xl border border-ink-100 bg-white shadow-soft p-4">
      <div className="text-[11px] uppercase tracking-wide text-ink-500 font-medium">{label}</div>
      <div className="text-2xl font-semibold text-ink-900 mt-1">{value}</div>
      <div className="text-[11px] text-emerald-700 mt-0.5">{trend}</div>
    </div>
  );
}

function ApprovalRow({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-ink-100 p-3">
      <div className="flex-1 min-w-0">
        <div className="text-sm text-ink-900 truncate">{title}</div>
        <div className="text-[11px] text-ink-500">{meta}</div>
      </div>
      <Button variant="outline" size="sm">Review</Button>
      <Button variant="success" size="sm">Approve</Button>
    </div>
  );
}

function PortalProject({
  name,
  pct,
  status,
  tone,
}: {
  name: string;
  pct: number;
  status: string;
  tone: "success" | "flow" | "warn";
}) {
  return (
    <li>
      <div className="flex items-center justify-between text-sm">
        <span className="text-ink-900">{name}</span>
        <Badge tone={tone}>{status}</Badge>
      </div>
      <div className="mt-1.5 h-1.5 w-full rounded-full bg-ink-100 overflow-hidden">
        <div
          className={`h-full rounded-full ${
            tone === "success" ? "bg-emerald-500" : tone === "warn" ? "bg-amber-500" : "bg-flow-600"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1 flex justify-end text-[11px] text-ink-500">{pct}%</div>
    </li>
  );
}
