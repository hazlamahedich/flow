import type { ClientHealthInput, ClientHealthProposal } from './schemas';

export async function execute(_input: ClientHealthInput): Promise<ClientHealthProposal> {
  throw new Error('client-health.execute not implemented');
}
