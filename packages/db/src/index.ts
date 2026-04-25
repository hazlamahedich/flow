export { createServerClient, createBrowserClient, createServiceClient } from './client';
export { createAdminSupabase } from './admin-client';
export {
  requireTenantContext,
  setTenantContext,
  createFlowError,
} from './rls-helpers';
export type { TenantContext } from './rls-helpers';
export { setActiveWorkspace } from './workspace-jwt';
export {
  getRevalidationTags,
  invalidateAfterMutation,
  cacheTag,
} from './cache-policy';
export type { CacheEntity, CacheMutation } from './cache-policy';
export { getConfig } from './config';
export * from './schema';
export {
  ensureUserProfile,
  getUserProfile,
  updateUserProfile,
  updateAvatarUrl,
  requestEmailChangeAtomic,
  syncUserEmail,
} from './queries/users';
export { getDashboardSummary, getDashboardCacheTag } from './queries/dashboard';
export type { DashboardSummary } from './queries/dashboard';
export { listUserWorkspaces } from './queries/workspaces';
export type { UserWorkspace } from './queries/workspaces';
export { searchEntities } from './queries/search/search-entities';
export type { SearchEntitiesOptions } from './queries/search/search-entities';
export {
  insertSignal,
  getSignalsByCorrelationId,
  getSignalsByWorkspace,
  insertRun,
  updateRunStatus,
  getRunsByWorkspace,
  getRunByJobId,
  getRunById,
  findByIdempotencyKey,
  claimRunWithGuard,
  findStaleRuns,
  releaseRun,
  getAgentConfigurations,
  getUserAgentConfigurations,
  getActiveAgentCount,
  getUserActiveAgentCount,
  getAgentConfiguration,
  getUserAgentConfiguration,
  transitionAgentStatus,
  updateAgentConfig,
  markSetupCompleted,
  updateIntegrationHealth,
  upsertAgentConfiguration,
  AgentTransitionError,
  insertCostLog,
  insertCostEstimate,
  getWorkspaceSpend,
  getDailySpend,
  checkBudgetThreshold,
  writeBudgetAuditAlert,
  hasBudgetAlertThisPeriod,
} from './queries/agents';
export type { CostLogEntry, CostLogRow } from './queries/agents';
export {
  getTrustMatrix,
  getTrustMatrixEntry,
  upsertTrustMatrixEntry,
  updateTrustMatrixEntry,
  recordSuccess as recordTrustSuccess,
  recordViolation as recordTrustViolation,
  recordPrecheckFailure as recordTrustPrecheckFailure,
  insertTransition,
  getTransitions,
  insertSnapshot,
  getSnapshotByExecution,
  getPreconditions,
  upsertPrecondition,
  deletePrecondition,
} from './queries/trust';
export type { TrustTransitionDbRow, TrustPreconditionDbRow } from './queries/trust';
export {
  getPendingApprovals,
  getPendingApprovalCount,
  getAgentBreakdown,
} from './queries/agents/approval-queries';
