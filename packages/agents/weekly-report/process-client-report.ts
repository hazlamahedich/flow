import type { SupabaseClient } from '@supabase/supabase-js';
import { 
  aggregateReportData, 
  checkBudgetThreshold, 
  insertCostLog, 
  insertCostEstimate
} from '@flow/db';
import { createLLMRouter } from '../shared/llm-router';
import type { WeeklyReportInput, WeeklyReportProposal } from './schemas';
import { verifyHallucinations } from './hallucination-checker';
import { z } from 'zod';
import { buildSectionsPayload, buildPreview } from './section-builder';

const llmOutputSchema = z.record(z.string(), z.string());

interface ProcessClientReportOptions {
  persist?: boolean;
}

async function getWorkspaceBudgetStart(supabase: SupabaseClient, workspaceId: string): Promise<Date> {
  const { data: member } = await supabase
    .from('workspace_members')
    .select('users!inner(timezone)')
    .eq('workspace_id', workspaceId)
    .eq('role', 'owner')
    .limit(1)
    .maybeSingle();

  const tz = (member?.users as { timezone?: string } | null)?.timezone || 'UTC';
  const now = new Date();
  const localMonthStartStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const [yyyy, mm] = localMonthStartStr.split('-');
  return new Date(`${yyyy}-${mm}-01T00:00:00Z`);
}

export async function processClientReport(
  supabase: SupabaseClient,
  input: WeeklyReportInput,
  options?: ProcessClientReportOptions,
): Promise<WeeklyReportProposal & { sectionsPayload?: unknown[] }> {
  const { workspaceId, clientId, periodStart, periodEnd, agentRunId } = input;
  const shouldPersist = options?.persist !== false;

  const cooldownDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: rejectedProposals, error: cooldownError } = await supabase
    .from('agent_proposals')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('status', 'rejected')
    .gt('updated_at', cooldownDate);

  if (cooldownError) throw cooldownError;
  if (rejectedProposals && rejectedProposals.length > 0) {
    throw new Error(`24-hour cooldown active: proposal rejected recently for client ${clientId}`);
  }

  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('id, name')
    .eq('id', clientId)
    .eq('workspace_id', workspaceId)
    .single();
  if (clientErr || !client) {
    throw new Error(`Client not found or tenant boundary violation: ${clientId}`);
  }

  let { data: template } = await supabase
    .from('report_templates')
    .select('id, sections_config, branding')
    .eq('workspace_id', workspaceId)
    .eq('client_id', clientId)
    .maybeSingle();

  if (!template) {
    const { data: defaultTemplate } = await supabase
      .from('report_templates')
      .select('id, sections_config, branding')
      .eq('workspace_id', workspaceId)
      .is('client_id', null)
      .maybeSingle();
    template = defaultTemplate;
  }

  const sectionsConfig = (template?.sections_config as Record<string, { enabled: boolean; sort_order: number }>) ?? {};
  const hasConfig = Object.keys(sectionsConfig).length > 0;
  const enabledSections = Object.entries(sectionsConfig)
    .filter(([_, cfg]) => cfg.enabled)
    .sort(([__a, a], [__b, b]) => a.sort_order - b.sort_order)
    .map(([type]) => type);

  const activeSections = hasConfig
    ? enabledSections
    : ['time_summary', 'task_log', 'stalled_items', 'agent_activity', 'highlights'];

  const budgetStart = await getWorkspaceBudgetStart(supabase, workspaceId);
  const budgetCheck = await checkBudgetThreshold(workspaceId, 500, budgetStart);
  if (!budgetCheck.allowed) {
    throw new Error(`LLM Budget exceeded for workspace ${workspaceId}`);
  }

  const aggregatedData = await aggregateReportData(supabase, {
    workspaceId,
    clientId,
    periodStart,
    periodEnd,
  });

  if (!aggregatedData.hasActivity) {
    return {
      title: `Weekly Report for ${client.name}`,
      confidence: 0,
      reasoning: 'No activity found in period.',
      riskLevel: 'low',
      preview: 'No activity found in period.',
    };
  }

  const router = createLLMRouter(undefined, {
    async insertEstimate(entry) {
      const row = await insertCostEstimate(entry);
      return row.id;
    },
    async insertActual(entry) {
      await insertCostLog(entry);
    },
  });

  const systemPrompt = `You are a professional weekly report narrative generator for Flow OS.
Your task is to generate executive narrative summaries for the specified report sections.

You MUST follow these rules:
1. Formulate clear, concise, and professional prose for each section.
2. Only include sections requested by the user.
3. Keep all numbers, metrics, and details exactly correct based on the input aggregated data.
4. Output strictly a single JSON object where keys are the section types and values are the narrative strings.
5. Do NOT include markdown fences, extra keys, or explanations. Just pure JSON.

Requested Sections to generate narratives for:
${activeSections.join(', ')}`;

  const userPrompt = `Generate weekly narratives for client "${client.name}" for period ${periodStart} to ${periodEnd}.
Aggregated Period Data:
${JSON.stringify(aggregatedData, null, 2)}`;

  const response = await router.complete(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    { workspaceId, agentId: 'weekly-report', runId: agentRunId },
    { taskTier: 'quality', maxTokens: 2000, temperature: 0.3 }
  );

  let narratives: Record<string, string>;
  try {
    const cleanText = response.text
      .replace(/^```(?:json)?\s*\n?/m, '')
      .replace(/\n?\s*```\s*$/m, '')
      .trim();
    narratives = llmOutputSchema.parse(JSON.parse(cleanText));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`POST_CHECK_VIOLATION: LLM returned malformed JSON: ${msg}`);
  }

  const mismatches = verifyHallucinations(narratives, aggregatedData);
  if (mismatches.length > 0) {
    throw new Error(`HALLUCINATION_DETECTED: LLM invented values not present in aggregate: ${mismatches.join(', ')}`);
  }

  const sectionsPayload = buildSectionsPayload(activeSections, narratives, aggregatedData);
  const preview = buildPreview(activeSections, narratives);

  if (!shouldPersist) {
    return {
      title: `Weekly Report Draft for ${client.name}`,
      confidence: 0.95,
      reasoning: 'Draft compiled accurately using pre-aggregated narrative prose.',
      riskLevel: 'low',
      preview,
      sectionsPayload,
    };
  }

  const { data: ownerMember } = await supabase
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', workspaceId)
    .eq('role', 'owner')
    .limit(1)
    .single();

  const creatorUserId = ownerMember?.user_id ?? workspaceId;

  const { data: reportId, error: rpcError } = await supabase.rpc(
    'create_weekly_report_with_sections',
    {
      p_workspace_id: workspaceId,
      p_client_id: clientId,
      p_period_start: periodStart,
      p_period_end: periodEnd,
      p_template_id: template?.id ?? null,
      p_generated_by: creatorUserId,
      p_template_snapshot: template ?? {},
      p_sections: sectionsPayload,
    }
  );

  if (rpcError || !reportId) {
    throw new Error(`Failed to persist report via database RPC: ${rpcError?.message}`);
  }

  return {
    reportId,
    title: `Weekly Report Draft for ${client.name}`,
    confidence: 0.95,
    reasoning: 'Draft compiled accurately using pre-aggregated narrative prose.',
    riskLevel: 'low',
    preview,
  };
}
