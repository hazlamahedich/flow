import { Topbar } from "@/components/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AgentIcon } from "@/components/agent-icon";
import { tasks, clients } from "@/lib/mock-data";

const columns: { k: "todo" | "doing" | "review" | "done"; label: string; tone: any }[] = [
  { k: "todo", label: "To do", tone: "neutral" },
  { k: "doing", label: "Doing", tone: "flow" },
  { k: "review", label: "Review", tone: "warn" },
  { k: "done", label: "Done", tone: "success" },
];

export default function TasksPage() {
  return (
    <>
      <Topbar title="Tasks" subtitle="A unified view across all clients · 4 created by agents this week" />
      <div className="p-6 max-w-[1200px]">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {columns.map((col) => {
            const items = tasks.filter((t) => t.status === col.k);
            return (
              <div key={col.k} className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <Badge tone={col.tone}>{col.label}</Badge>
                  <span className="text-xs text-ink-500">{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.map((t) => {
                    const c = clients.find((x) => x.id === t.clientId);
                    return (
                      <Card key={t.id}>
                        <CardContent className="p-3">
                          <div className="flex items-start gap-2">
                            <p className="text-sm text-ink-900 flex-1">{t.title}</p>
                            {t.agentSource && <AgentIcon k={t.agentSource} size={20} />}
                          </div>
                          <div className="mt-2 flex items-center gap-2 text-[11px] text-ink-500 flex-wrap">
                            <span>{c?.name ?? "—"}</span>
                            {t.due && <Badge>{t.due}</Badge>}
                            {t.estimateHrs && (
                              <span>· {t.estimateHrs}h</span>
                            )}
                            {t.origin === "agent" && (
                              <Badge tone="violet">agent-created</Badge>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                  {items.length === 0 && (
                    <div className="text-xs text-ink-400 px-2 py-3">Nothing here.</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
