import { Topbar } from "@/components/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { tiers } from "@/lib/mock-data";
import { Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  return (
    <>
      <Topbar
        title="Settings"
        subtitle="Workspace · Billing · Per-workspace pricing — radically cheaper as your team grows"
      />

      <div className="p-6 max-w-[1100px] space-y-6">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-gradient-to-br from-flow-500 to-violet-500 grid place-items-center text-white">
                <Sparkles size={18} />
              </div>
              <div className="flex-1">
                <div className="text-xs text-ink-500">Workspace</div>
                <div className="text-sm font-semibold text-ink-900">Maya's Workspace</div>
              </div>
              <Badge tone="flow">Pro · $29/mo</Badge>
              <Button variant="outline" size="sm">Manage workspace</Button>
            </div>
          </CardContent>
        </Card>

        <div>
          <h2 className="text-sm font-semibold text-ink-900 mb-1">Plans</h2>
          <p className="text-xs text-ink-500 mb-4">
            Per-workspace pricing. A 5-person agency pays $59 total — vs $125+ on per-seat tools.
          </p>
          <div className="grid md:grid-cols-3 gap-4">
            {tiers.map((t) => (
              <Card
                key={t.name}
                className={cn(
                  "relative overflow-hidden",
                  t.current && "ring-2 ring-flow-500"
                )}
              >
                {t.current && (
                  <div className="absolute top-0 right-0 px-2 py-0.5 text-[10px] font-semibold bg-flow-600 text-white rounded-bl-lg">
                    CURRENT
                  </div>
                )}
                <CardContent className="p-5 space-y-4">
                  <div>
                    <div className="text-sm font-semibold text-ink-900">{t.name}</div>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-3xl font-semibold text-ink-900">${t.price}</span>
                      <span className="text-xs text-ink-500">/mo</span>
                    </div>
                    <p className="text-[11px] text-ink-500 mt-1">{t.blurb}</p>
                  </div>
                  <ul className="space-y-2">
                    {t.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-xs text-ink-700">
                        <Check size={14} className="mt-0.5 text-emerald-600 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    variant={t.current ? "outline" : "accent"}
                    size="md"
                    className="w-full"
                    disabled={t.current}
                  >
                    {t.current ? "Current plan" : t.price === 0 ? "Downgrade" : "Upgrade"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <Card>
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-ink-900">Per-workspace vs per-seat</h3>
            <p className="text-xs text-ink-500 mt-1">
              The more your team grows, the better the value. Opposite of every per-seat tool.
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-lg border border-ink-100 p-3">
                <div className="text-ink-500">Solo VA</div>
                <div className="text-ink-900 font-semibold mt-1">Flow OS $29</div>
                <div className="text-ink-400">vs ClickUp $25 · Notion $20</div>
              </div>
              <div className="rounded-lg border border-ink-100 p-3">
                <div className="text-ink-500">3 person team</div>
                <div className="text-ink-900 font-semibold mt-1">Flow OS $59</div>
                <div className="text-ink-400">vs ClickUp $75 · Notion $60</div>
              </div>
              <div className="rounded-lg border border-flow-200 bg-flow-50 p-3">
                <div className="text-flow-700">5 person agency</div>
                <div className="text-flow-900 font-semibold mt-1">Flow OS $59</div>
                <div className="text-flow-700">vs ClickUp $125+ · Notion $100+</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
