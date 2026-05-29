import Link from 'next/link';
import { getAgentActionLogAction } from '@/lib/actions/reports/get-agent-action-log';

export default async function AgentActionLogPage() {
  const result = await getAgentActionLogAction();
  const runs = result.success ? result.data ?? [] : [];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agent Action Log</h1>
          <p className="text-muted-foreground">Chronological log of all agent runs and decisions.</p>
        </div>
        <Link 
          href="/reports" 
          className="inline-flex items-center justify-center rounded-md bg-secondary px-4 py-2 text-sm font-medium hover:bg-secondary/80 transition-colors"
        >
          ← Back to Reports
        </Link>
      </div>

      <div className="rounded-md border bg-card">
        {runs.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <p className="text-sm text-muted-foreground">No agent actions logged yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Date</th>
                <th className="px-4 py-3 text-left font-medium">Agent</th>
                <th className="px-4 py-3 text-left font-medium">Action</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                    {new Date(run.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-medium capitalize">
                    {run.agentId.replace('-', ' ')}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {run.actionType}
                  </td>
                  <td className="px-4 py-3">
                    <span 
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        run.status === 'completed' 
                          ? 'bg-emerald-50 text-emerald-700' 
                          : run.status === 'running'
                          ? 'bg-blue-50 text-blue-700'
                          : run.status === 'waiting_approval'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-rose-50 text-rose-700'
                      }`}
                    >
                      {run.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground max-w-xs truncate text-xs">
                    {run.error ? String(run.error.message || run.error) : (run.output ? JSON.stringify(run.output) : '—')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
