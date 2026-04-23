import type { ArCollectionProposal } from './schemas';

export async function preCheck(_proposal: ArCollectionProposal): Promise<{
  passed: boolean;
  errors: string[];
}> {
  throw new Error('ar-collection.preCheck not implemented');
}
