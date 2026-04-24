import type { AgentId } from './types';

interface RiskWeightEntry {
  agentId: AgentId;
  actionType: string;
  weight: number;
}

const ENTRIES: RiskWeightEntry[] = [
  { agentId: 'inbox', actionType: 'categorize_email', weight: 0.5 },
  { agentId: 'inbox', actionType: 'extract_action_items', weight: 0.5 },
  { agentId: 'inbox', actionType: 'draft_response', weight: 1.5 },
  { agentId: 'calendar', actionType: 'schedule_meeting', weight: 1.0 },
  { agentId: 'calendar', actionType: 'detect_conflict', weight: 0.5 },
  { agentId: 'calendar', actionType: 'send_invite', weight: 1.5 },
  { agentId: 'ar-collection', actionType: 'draft_followup_email', weight: 2.0 },
  { agentId: 'ar-collection', actionType: 'schedule_reminder', weight: 1.0 },
  { agentId: 'weekly-report', actionType: 'compile_report', weight: 0.5 },
  { agentId: 'weekly-report', actionType: 'draft_summary', weight: 1.0 },
  { agentId: 'client-health', actionType: 'analyze_health', weight: 0.5 },
  { agentId: 'client-health', actionType: 'flag_risk', weight: 1.5 },
  { agentId: 'client-health', actionType: 'draft_communication', weight: 2.0 },
  { agentId: 'time-integrity', actionType: 'detect_anomaly', weight: 1.0 },
  { agentId: 'time-integrity', actionType: 'flag_entry', weight: 1.5 },
];

type RiskWeightKey = `${AgentId}:${string}`;
const RISK_WEIGHTS = new Map<RiskWeightKey, number>(
  ENTRIES.map((e) => [`${e.agentId}:${e.actionType}`, e.weight]),
);

export { RISK_WEIGHTS };
export { ENTRIES as RISK_WEIGHT_ENTRIES };
export type { RiskWeightEntry };
