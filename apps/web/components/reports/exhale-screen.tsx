import type { FridayFeelingData } from '@/lib/actions/reports/get-friday-feeling';

interface TrustMilestone {
  agent_type: string;
  from_level: string;
  to_level: string;
  reached_at: string;
}

function formatAgentLabel(agentType: string): string {
  const labels: Record<string, string> = {
    time_integrity: 'Time Integrity',
    email_categorizer: 'Email',
    calendar: 'Calendar',
    weekly_report: 'Weekly Report',
    client_health: 'Client Health',
    morning_brief: 'Morning Brief',
  };
  return labels[agentType] ?? agentType;
}

function formatTrustLevel(level: string): string {
  const labels: Record<string, string> = {
    supervised: 'Supervised',
    confirm: 'Confirm',
    auto: 'Auto-Approve',
    auto_approve: 'Auto-Approve',
    suggest: 'Suggest',
  };
  return labels[level] ?? level;
}

export function ExhaleScreen({ summary }: { summary: FridayFeelingData }) {
  const milestones = (summary.trustMilestones as TrustMilestone[]) ?? [];
  const hasActivity = summary.tasksHandled > 0 || milestones.length > 0;

  return (
    <div className="exhale-screen rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-8 shadow-sm">
      <div className="mb-6 border-b-2 border-amber-400 pb-4">
        <h2 className="text-2xl font-semibold text-gray-900">
          {summary.headline}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Week of {summary.weekStart} — {summary.weekEnd}
        </p>
      </div>

      {hasActivity ? (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-emerald-50 p-4">
              <p className="text-3xl font-bold text-emerald-700">
                {summary.tasksHandled}
              </p>
              <p className="text-sm text-emerald-600">Tasks handled</p>
            </div>
            <div className="rounded-lg bg-blue-50 p-4">
              <p className="text-3xl font-bold text-blue-700">
                {summary.timeSavedMinutes}
              </p>
              <p className="text-sm text-blue-600">Minutes saved</p>
            </div>
          </div>

          {milestones.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wider">
                Trust Milestones
              </h3>
              {milestones.map((m, i) => (
                <div
                  key={`${m.agent_type}-${i}`}
                  className="flex items-center gap-3 rounded-md bg-emerald-50 px-4 py-2 text-sm"
                >
                  <span className="inline-block rounded-full bg-emerald-200 px-2 py-0.5 text-xs font-medium text-emerald-800">
                    {formatAgentLabel(m.agent_type)}
                  </span>
                  <span className="text-gray-600">
                    {formatTrustLevel(m.from_level)} →{' '}
                    {formatTrustLevel(m.to_level)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="text-gray-600 leading-relaxed">
          Your agents are fully charged and ready for next week.
        </p>
      )}
    </div>
  );
}

export function renderExhaleScreen(summary: FridayFeelingData): string {
  const milestones = (summary.trustMilestones as TrustMilestone[]) ?? [];
  const parts = [
    summary.headline,
    `Tasks: ${summary.tasksHandled}`,
    `Minutes saved: ${summary.timeSavedMinutes}`,
  ];
  for (const m of milestones) {
    parts.push(`${m.agent_type}: ${m.from_level} → ${m.to_level}`);
  }
  return parts.join(' | ');
}
