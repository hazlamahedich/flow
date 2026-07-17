export { execute } from './executor';
export type { SweepDeps } from './executor';
export { preCheck } from './pre-check';
export {
  detectGaps,
  detectOverlaps,
  detectLowHours,
} from './anomaly-detection';
export type { TimeEntryForDetection } from './anomaly-detection';
export {
  timeIntegrityInputSchema,
  timeIntegrityProposalSchema,
  anomalySignalSchema,
  GAP_THRESHOLD_MINUTES,
  LOW_HOURS_TARGET,
} from './schemas';
export type {
  TimeIntegrityInput,
  TimeIntegrityProposal,
  SweepResult,
  AnomalySignal,
  AnomalyType,
} from './schemas';
