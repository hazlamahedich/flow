import type { ClientHealthProposal } from './schemas';

export async function preCheck(_proposal: ClientHealthProposal): Promise<{
  passed: boolean;
  errors: string[];
}> {
  throw new Error('client-health.preCheck not implemented');
}
