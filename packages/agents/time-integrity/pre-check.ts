import type { TimeIntegrityProposal } from './schemas';

export async function preCheck(_proposal: TimeIntegrityProposal): Promise<{
  passed: boolean;
  errors: string[];
}> {
  throw new Error('time-integrity.preCheck not implemented');
}
