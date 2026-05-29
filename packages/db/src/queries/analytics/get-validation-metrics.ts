import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from '../../client';

export interface ValidationMetric {
  id: string;
  workspace_id: string;
  metric_type: string;
  value: number;
  dimensions: Record<string, unknown>;
  recorded_at: string;
}

export async function getValidationMetrics(
  client: SupabaseClient,
  workspaceId: string,
  metricType: string,
  periodDays: number,
): Promise<ValidationMetric[]> {
  const from = new Date(
    Date.now() - periodDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data, error } = await client
    .from("validation_metrics")
    .select("id, workspace_id, metric_type, value, dimensions, recorded_at")
    .eq("workspace_id", workspaceId)
    .eq("metric_type", metricType)
    .gte("recorded_at", from)
    .order("recorded_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as ValidationMetric[];
}

export async function recordValidationMetric(
  workspaceId: string,
  metricType: string,
  value: number,
  dimensions: Record<string, unknown>,
): Promise<ValidationMetric> {
  const serviceClient = createServiceClient();

  const { data, error } = await serviceClient
    .from("validation_metrics")
    .insert({
      workspace_id: workspaceId,
      metric_type: metricType,
      value,
      dimensions,
    })
    .select(
      "id, workspace_id, metric_type, value, dimensions, recorded_at",
    )
    .single();

  if (error) throw error;
  return data as ValidationMetric;
}
