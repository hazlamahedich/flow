import type { TimeIntegrityInput, TimeIntegrityProposal } from './schemas';

export async function execute(_input: TimeIntegrityInput): Promise<TimeIntegrityProposal> {
  throw new Error('time-integrity.execute not implemented');
}
