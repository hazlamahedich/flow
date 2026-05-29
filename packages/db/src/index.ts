export { createServerClient, createBrowserClient, createServiceClient } from './client';
export { createAdminSupabase } from './admin-client';
export type { SupabaseClient } from '@supabase/supabase-js';
export {  requireTenantContext,
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
export { listUserWorkspaces, listAllWorkspaces } from './queries/workspaces';
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
export { decryptInboxTokens, encryptInboxTokens } from './vault/inbox-tokens';
export type { CostLogEntry, CostLogRow } from './queries/agents';
export type {
  ActionHistoryFilters,
  ActionHistoryRow,
  AgentRunError,
  CoordinationGroup,
  CorrectionInfo,
  FeedbackRow,
} from './queries/agents/history-types';
export {
  getActionHistory,
  getCoordinationGroups,
  getRunDetail,
  getRecentActivity,
  getCorrectionChain,
} from './queries/agents/history-queries';
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
  getUnacknowledgedRegressions,
  acknowledgeTransition,
  recordMilestone,
} from './queries/trust';
export type { TrustTransitionDbRow, TrustPreconditionDbRow, UnacknowledgedRegression } from './queries/trust';
export {
  getTrustEvents,
  getCheckInDue,
  getRecentAutoActions,
  getCheckInSetting,
  setCheckInSetting,
} from './queries/trust';
export type {
  TrustEventFilters,
  TrustEventRow,
  TrustEventPage,
  CheckInDueRow,
  AutoActionRow,
  CheckInSettingResult,
} from './queries/trust';
export {
  getPendingApprovals,
  getPendingApprovalCount,
  getAgentBreakdown,
  mapRun,
} from './queries/agents/approval-queries';
export {
  getClientById,
  listClients,
  insertClient,
  updateClient,
  archiveClient,
  restoreClient,
  countActiveClients,
  checkDuplicateEmail,
  hasActiveAgentRuns,
} from './queries/clients';
export { listAllActiveClients } from './queries/clients';
export type { ActiveClientSummary } from './queries/clients';
export { getClientEngagementTimeline } from './queries/clients/timeline';
export {
  assignMemberToClient,
  revokeMemberAccess,
  getMembersForClient,
  getClientsForMember,
} from './queries/clients/scoping';
export {
  getActiveRetainerForClient,
  getRetainerById,
  listRetainersForClient,
  createRetainer,
  updateRetainer,
  cancelRetainer,
  getRetainerUtilization,
  getScopeCreepAlerts,
  getCurrentBillingPeriod,
} from './queries/retainers';
export type { UtilizationResult, BillingPeriod } from './queries/retainers';
export {
  createClientInbox,
  getClientInboxes,
  getClientInboxById,
  getClientInboxByEmail,
  updateClientInboxSyncStatus,
  updateClientInboxOAuthState,
  getConnectedInboxes,
  clearClientInboxTokens,
  saveMorningBrief,
  insertEmail,
  updateEmailCategorization,
  getUnprocessedEmails,
  getHandledEmails,
  getWeeklyAuditCount,
  updateInboxTrustMetric,
  recategorizeEmail,
} from './queries/inbox';


export { insertRawPayload, isMessageProcessed, markMessageProcessed } from './queries/inbox';

export { createTimeEntry, listTimeEntries, softDeleteTimeEntry } from './queries/time-entries';
export type { TimeEntry, CreateTimeEntryInput, TimeEntryFilters, ListTimeEntriesInput, ListTimeEntriesResult, SoftDeleteTimeEntryInput } from './queries/time-entries';

export { getTimerState, startTimer, stopTimerRpc, updateTimeEntry, insertEditHistory, getTimeEntryForUpdate, defaultInvoiceEditGuard } from './queries/time-tracking';
export type { TimerStateWithNames, GetTimerStateInput, StartTimerInput, StopTimerRpcInput, StopTimerResult, UpdateTimeEntryInput, UpdateTimeEntryResult, InsertEditHistoryInput, GetTimeEntryForUpdateInput, TimeEntryCurrentValues, InvoiceEditGuard } from './queries/time-tracking';

export { createProject, ProjectNameDuplicateError, listProjects } from './queries/projects';
export type { Project, CreateProjectInput, ListProjectsInput } from './queries/projects';
export { decryptCalendarTokens, encryptCalendarTokens, rotateCalendarTokens } from './vault/calendar-tokens';
export { getPaymentAttemptsByInvoice } from './queries/invoices/get-payment-attempts';
export type { PaymentAttempt } from './queries/invoices/get-payment-attempts';
export {
  getInvoices,
  getInvoiceDetail,
  getInvoiceWithBalance,
  getInvoicePayments,
  recordPaymentViaRpc,
  resolveHourlyRate,
  voidInvoiceViaRpc,
  issueCreditNoteViaRpc,
  getTimeEntryReconciliation,
  getClientFinancialSummary,
} from './queries/invoices';
export type {
  GetInvoicesParams,
  InvoiceDetail,
  InvoiceWithPaymentsAndBalance,
  PaymentHistoryRecord,
  InvoicePaymentResult,
  ResolveHourlyRateResult,
  VoidInvoiceResult,
  IssueCreditNoteResult,
  TimeEntryReconciliationRow,
  ClientFinancialSummary,
  InvoiceListItem,
} from './queries/invoices';
export { createInvoiceEditGuard } from './queries/invoices/invoice-edit-guard';
export { aggregateReportData } from './queries/reports/aggregate-data';
export type { AggregateReportDataOptions, AggregatedReportData, StalledItem } from './queries/reports/aggregate-data';
