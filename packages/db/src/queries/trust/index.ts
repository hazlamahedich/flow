export {
  getTrustMatrix,
  getTrustMatrixEntry,
  upsertTrustMatrixEntry,
  updateTrustMatrixEntry,
  recordSuccess,
  recordViolation,
  recordPrecheckFailure,
} from './matrix';
export type { TrustMatrixDbRow } from './matrix';

export { insertTransition, getTransitions } from './transitions';
export type { TrustTransitionDbRow, TrustTransitionInsert } from './transitions';

export { insertSnapshot, getSnapshotByExecution } from './snapshots';
export type { TrustSnapshotDbRow, TrustSnapshotInsert } from './snapshots';

export {
  getPreconditions,
  upsertPrecondition,
  deletePrecondition,
} from './preconditions';
export type { TrustPreconditionDbRow } from './preconditions';
