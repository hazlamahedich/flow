export interface AuditLogParams {
  workspaceId: string;
  agentId: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: Record<string, unknown>;
}

export function writeAuditLog(_params: AuditLogParams): void {}
