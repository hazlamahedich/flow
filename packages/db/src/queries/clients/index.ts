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
