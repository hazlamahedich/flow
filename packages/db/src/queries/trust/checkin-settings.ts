import { createServiceClient } from '../../client';

export async function getCheckInSetting(workspaceId: string): Promise<boolean> {
  const client = createServiceClient();
  const { data, error } = await client
    .from('workspaces')
    .select('settings')
    .eq('id', workspaceId)
    .single();
  if (error) throw error;
  const settings = data?.settings as Record<string, unknown> | null;
  return settings?.trust_checkin_enabled === true || settings?.trust_checkin_enabled === 'true';
}

export async function setCheckInSetting(
  workspaceId: string,
  enabled: boolean,
): Promise<boolean> {
  const client = createServiceClient();
  const { data: current, error: fetchErr } = await client
    .from('workspaces')
    .select('settings')
    .eq('id', workspaceId)
    .single();
  if (fetchErr) throw fetchErr;

  const existing = (current?.settings ?? {}) as Record<string, unknown>;
  const merged = { ...existing, trust_checkin_enabled: enabled };

  const { error } = await client
    .from('workspaces')
    .update({ settings: merged })
    .eq('id', workspaceId);
  if (error) throw error;
  return true;
}
