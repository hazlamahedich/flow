export type TrustTier = 'supervised' | 'assisted' | 'autonomous';

export async function getTrustTier(
  _agentId: string,
  _workspaceId: string,
): Promise<TrustTier> {
  return 'supervised';
}
