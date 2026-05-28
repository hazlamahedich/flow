import Link from 'next/link';
import { formatCentsToDollar } from '@flow/shared';
import { formatDuration } from '@/lib/format-duration';

interface TaskEntry {
  date: string;
  durationMinutes: number;
  notes: string;
}

interface ProjectGroup {
  projectName: string;
  entries: TaskEntry[];
}

interface AgentRun {
  actionType: string;
  status: string;
  count: number;
}

interface InvoiceSummaryContent {
  totalCents: number;
  amountPaidCents: number;
  invoiceCount: number;
}

export function TaskLogSection({ content }: { content: { projects?: ProjectGroup[] } }) {
  const projects = content?.projects ?? [];
  const totalEntries = projects.reduce((sum, p) => sum + p.entries.length, 0);
  return (
    <section data-testid="section-task-log" className="space-y-2">
      <h2 className="text-lg font-semibold tracking-tight">Task Log</h2>
      {totalEntries === 0 ? (
        <p className="text-sm text-muted-foreground">No tasks logged this period</p>
      ) : (
        <div className="space-y-4">
          {projects.map((group) => (
            <div key={group.projectName || 'uncategorized'}>
              <h3 className="text-base font-medium mb-2">{group.projectName || 'Uncategorized'}</h3>
              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left font-medium">Date</th>
                      <th className="px-4 py-3 text-right font-medium">Duration</th>
                      <th className="px-4 py-3 text-left font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.entries.map((entry, i) => (
                      <tr key={`${group.projectName}-${i}`} className="border-b last:border-0">
                        <td className="px-4 py-3 text-muted-foreground">{entry.date}</td>
                        <td className="px-4 py-3 text-right font-mono">{formatDuration(entry.durationMinutes)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{entry.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function AgentActivitySection({ content }: { content: { runs?: AgentRun[] } }) {
  const runs = content?.runs ?? [];
  return (
    <section data-testid="section-agent-activity" className="space-y-2">
      <h2 className="text-lg font-semibold tracking-tight">Agent Activity</h2>
      {runs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No agent activity this period</p>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Action</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Count</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={`${run.actionType}-${run.status}`} className="border-b last:border-0">
                  <td className="px-4 py-3">{run.actionType}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                      {run.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{run.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function InvoiceSummarySection({ content }: { content: InvoiceSummaryContent }) {
  const total = content?.totalCents ?? 0;
  const paid = content?.amountPaidCents ?? 0;
  const count = content?.invoiceCount ?? 0;
  return (
    <section data-testid="section-invoice-summary" className="space-y-2">
      <h2 className="text-lg font-semibold tracking-tight">Invoice Summary</h2>
      {count === 0 ? (
        <p className="text-sm text-muted-foreground">No invoices issued this period</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-md border p-4 space-y-1">
            <p className="text-sm text-muted-foreground">Invoices</p>
            <p className="text-2xl font-bold">{count}</p>
          </div>
          <div className="rounded-md border p-4 space-y-1">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">{formatCentsToDollar(total)}</p>
          </div>
          <div className="rounded-md border p-4 space-y-1">
            <p className="text-sm text-muted-foreground">Paid</p>
            <p className="text-2xl font-bold">{formatCentsToDollar(paid)}</p>
          </div>
        </div>
      )}
    </section>
  );
}
