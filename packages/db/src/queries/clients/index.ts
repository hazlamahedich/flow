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
} from './crud';
export { countArchivedClients, getLatestArchivedAt } from './crud-helpers';
export {
  assignMemberToClient,
  revokeMemberAccess,
  getMembersForClient,
  getClientsForMember,
} from './scoping';
export { getClientEngagementTimeline } from './timeline';
export { listAllActiveClients } from './list-all-active';
export type { ActiveClientSummary } from './list-all-active';
export {
  bulkArchiveClients,
  listActiveClientIdsMruFirst,
} from './archiveClients';
export type { BulkArchiveResult } from './archiveClients';
