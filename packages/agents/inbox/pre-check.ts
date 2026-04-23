import type { InboxProposal } from './schemas';

export async function preCheck(_proposal: InboxProposal): Promise<{
  passed: boolean;
  errors: string[];
}> {
  throw new Error('inbox.preCheck not implemented');
}
