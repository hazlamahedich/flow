export interface AuditLogParams {
  workspaceId: string;
  agentId: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: Record<string, unknown>;
}

export function writeAuditLog(params: AuditLogParams): void {
  const safeDetails = { ...params.details };
  delete safeDetails.workspaceId;
  delete safeDetails.agentId;

  const entry = {
    timestamp: new Date().toISOString(),
    workspaceId: params.workspaceId,
    agentId: params.agentId,
    actionType: params.action,
    correlationId: params.entityId ?? '',
    outcome: (params.details?.outcome as string) ?? 'unknown',
    details: safeDetails,
  };

  const json = JSON.stringify(entry);
  try {
    process.stdout.write(json + '\n');
  } catch {
    try {
      process.stderr.write(json + '\n');
    } catch {
      // silent fallback — no circular failure path
    }
  }
}
