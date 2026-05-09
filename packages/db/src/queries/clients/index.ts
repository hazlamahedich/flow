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
export {
  assignMemberToClient,
  revokeMemberAccess,
  getMembersForClient,
  getClientsForMember,
} from './scoping';
export { getClientEngagementTimeline } from './timeline';
export { listAllActiveClients } from './list-all-active';
export type { ActiveClientSummary } from './list-all-active';
