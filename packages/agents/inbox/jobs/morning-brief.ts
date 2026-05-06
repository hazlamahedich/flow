import { createServiceClient } from '@flow/db';
import { generateMorningBrief } from '../index';

const CRON_SCHEDULE = '0 6 * * *';
const TIMEOUT_MS = 30_000;

export interface MorningBriefJobPayload {
  workspaceId: string;
}

export async function handleMorningBriefScheduledJob(): Promise<void> {
  const supabase = createServiceClient();

  const { data: workspaces, error } = await supabase
    .from('workspaces')
    .select('id');

  if (error) {
    console.error('[morning-brief-job] Failed to enumerate workspaces:', error);
    throw error;
  }

  if (!workspaces || workspaces.length === 0) {
    console.log('[morning-brief-job] No active workspaces found');
    return;
  }

  console.log(`[morning-brief-job] Generating briefs for ${workspaces.length} workspaces`);

  const results = await Promise.allSettled(
    workspaces.map((ws) =>
      Promise.race([
        generateMorningBrief(ws.id),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout for workspace ${ws.id}`)), TIMEOUT_MS)
        ),
      ])
    )
  );

  const succeeded = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  console.log(`[morning-brief-job] Complete: ${succeeded} succeeded, ${failed} failed`);

  if (failed > 0) {
    for (const r of results) {
      if (r.status === 'rejected') {
        console.error('[morning-brief-job] Failure:', r.reason);
      }
    }
  }
}

export { CRON_SCHEDULE };
