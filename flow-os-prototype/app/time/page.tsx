"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause, Square, Plus } from "lucide-react";
import { Topbar } from "@/components/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { clients, timeEntries } from "@/lib/mock-data";
import { formatCurrency } from "@/lib/utils";

export default function TimePage() {
  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState(18 * 60 + 42);
  const [client, setClient] = useState(clients[2].id);
  const [desc, setDesc] = useState("Photography brief revisions");
  const ticker = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (running) {
      ticker.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    }
    return () => {
      if (ticker.current) clearInterval(ticker.current);
    };
  }, [running]);

  const fmt = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const totalToday = timeEntries.reduce((acc, e) => acc + e.durationMin, 0) + Math.floor(seconds / 60);
  const billableToday = timeEntries.filter((e) => e.billable).reduce((a, e) => a + e.durationMin, 0);
  const billableRate = 95;

  return (
    <>
      <Topbar
        title="Time"
        subtitle={`Today: ${(totalToday / 60).toFixed(1)}h tracked · ${(billableToday / 60).toFixed(1)}h billable · ${formatCurrency((billableToday / 60) * billableRate)} earnable`}
      />
      <div className="p-6 max-w-[1200px] space-y-6">
        {/* Timer */}
        <Card className="overflow-hidden">
          <CardContent className="p-6">
            <div className="grid lg:grid-cols-[1fr_auto] gap-6 items-center">
              <div className="grid sm:grid-cols-2 gap-3">
                <select
                  value={client}
                  onChange={(e) => setClient(e.target.value)}
                  className="h-11 rounded-lg border border-ink-200 bg-white px-3 text-sm"
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <input
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="What are you working on?"
                  className="h-11 rounded-lg border border-ink-200 bg-white px-3 text-sm"
                />
              </div>
              <div className="flex items-center gap-4 justify-end">
                <div className="text-4xl font-mono tabular-nums text-ink-900">{fmt(seconds)}</div>
                {!running ? (
                  <Button variant="success" size="lg" onClick={() => setRunning(true)}>
                    <Play size={16} /> Start
                  </Button>
                ) : (
                  <>
                    <Button variant="outline" size="lg" onClick={() => setRunning(false)}>
                      <Pause size={16} /> Pause
                    </Button>
                    <Button variant="danger" size="lg" onClick={() => { setRunning(false); setSeconds(0); }}>
                      <Square size={16} /> Stop
                    </Button>
                  </>
                )}
              </div>
            </div>

            <p className="text-[11px] text-ink-400 mt-3">
              Time Integrity agent will scan your calendar against time entries each evening and propose any unlogged work.
            </p>
          </CardContent>
        </Card>

        {/* Today list */}
        <Card>
          <CardContent>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-ink-900">Today's entries</h3>
              <Button variant="outline" size="sm">
                <Plus size={14} /> Add manual entry
              </Button>
            </div>
            <ul className="divide-y divide-ink-100">
              {timeEntries.map((e) => {
                const c = clients.find((x) => x.id === e.clientId)!;
                return (
                  <li key={e.id} className="py-3 flex items-center gap-4">
                    <div className="size-2 rounded-full bg-flow-500" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-ink-900 truncate">{e.description}</div>
                      <div className="text-[11px] text-ink-500">
                        {c.name} · {new Date(e.startedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                      </div>
                    </div>
                    <Badge tone={e.billable ? "success" : "neutral"}>
                      {e.billable ? "billable" : "internal"}
                    </Badge>
                    <div className="text-sm font-medium text-ink-900 tabular-nums w-16 text-right">
                      {Math.floor(e.durationMin / 60)
                        ? `${Math.floor(e.durationMin / 60)}h ${e.durationMin % 60}m`
                        : `${e.durationMin}m`}
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
