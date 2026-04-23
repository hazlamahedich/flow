import type { InboxInput, InboxProposal } from './schemas';

export async function execute(_input: InboxInput): Promise<InboxProposal> {
  throw new Error('inbox.execute not implemented');
}
