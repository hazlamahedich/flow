import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext } from '@flow/db';
import type { ActionResult } from '@flow/types';

interface ReportVersion {
  id: string;
  version: number;
  status: string;
  generatedAt: string;
  generatedBy: string;
}

export async function getReportVersions(
  input: { versionGroupId: string },
): Promise<ReportVersion[]> {
  const supabase = await getServerSupabase();
  let ctx;
  try {
    ctx = await requireTenantContext(supabase);
  } catch {
    return [];
  }

  if (!input.versionGroupId) {
    return [];
  }

  const { data, error } = await supabase
    .from('weekly_reports')
    .select('id, version, status, generated_at, generated_by')
    .eq('version_group_id', input.versionGroupId)
    .eq('workspace_id', ctx.workspaceId)
    .order('version', { ascending: true });

  if (error || !data) {
    return [];
  }

  return data.map((row) => ({
    id: row.id as string,
    version: row.version as number,
    status: row.status as string,
    generatedAt: row.generated_at as string,
    generatedBy: row.generated_by as string,
  }));
}

export async function getReportVersionsAction(
  input: { versionGroupId: string },
): Promise<ActionResult<ReportVersion[]>> {
  const versions = await getReportVersions(input);
  return { success: true, data: versions };
}
