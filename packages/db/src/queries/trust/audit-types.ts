export interface TrustEventFilters {
  agentId?: string | undefined;
  direction?: 'upgrade' | 'regression' | 'all' | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
  page: number;
}

export interface TrustEventRow {
  id: string;
  matrixEntryId: string;
  workspaceId: string;
  agentId: string;
  fromLevel: string;
  toLevel: string;
  triggerType: string;
  triggerReason: string;
  isContextShift: boolean;
  actor: string;
  createdAt: string;
}

export interface TrustEventPage {
  data: TrustEventRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CheckInDueRow {
  agentId: string;
  workspaceId: string;
  currentLevel: string;
  lastReviewedAt: string | null;
  auditCreatedAt: string;
  deferredCount: number;
  lastDeferredAt: string | null;
}

export interface AutoActionRow {
  id: string;
  agentId: string;
  actionType: string;
  status: string;
  createdAt: string;
  summary: string | null;
}

export interface CheckInSettingResult {
  enabled: boolean;
}
