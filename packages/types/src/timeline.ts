export type EmailTimelineEntry = {
  id: string;
  receivedAt: string;
  subject: string | null;
  fromAddress: string;
  category: 'urgent' | 'action' | 'info' | 'noise' | null;
  requiresConfirmation: boolean;
  processingState: string | null;
};

export type AgentRunTimelineEntry = {
  id: string;
  createdAt: string;
  agentId: string;
  actionType: string;
  status: 'running' | 'completed' | 'failed' | 'pending_approval' | 'cancelled';
  clientId: string | null;
  proposal?: { reasoning: string; content: string };
};

export type TimelineEvent =
  | { kind: 'email'; sortKey: string; data: EmailTimelineEntry }
  | { kind: 'agent_run'; sortKey: string; data: AgentRunTimelineEntry };
