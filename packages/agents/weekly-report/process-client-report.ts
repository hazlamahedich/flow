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

const llmOutputSchema = z.record(z.string(), z.string());

export async function processClientReport(
  supabase: SupabaseClient,
  input: WeeklyReportInput
): Promise<WeeklyReportProposal> {
  const { workspaceId, clientId, periodStart, periodEnd, agentRunId } = input;
  const cooldownDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: rejectedReports, error: rejectedError } = await supabase
    .from('weekly_reports')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('client_id', clientId)
    .eq('status', 'rejected')
    .gt('updated_at', cooldownDate);

  if (rejectedError) throw rejectedError;
  if (rejectedReports && rejectedReports.length > 0) {
    throw new Error(`24-hour cooldown active: report generation rejected recently for client ${clientId}`);
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

  const now = new Date();
  const budgetStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
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

  const sectionTitleMap: Record<string, string> = {
    time_summary: 'Time Summary',
    task_log: 'Task Log',
    stalled_items: 'Stalled Items',
    agent_activity: 'Agent Activity',
    highlights: 'Highlights',
    invoice_summary: 'Invoice Summary',
  };

  const sectionsPayload = activeSections.map((secType, index) => {
    let baseContent: Record<string, unknown> = {};
    if (secType === 'time_summary') baseContent = { totalMinutes: aggregatedData.timeSummary.totalMinutes };
    else if (secType === 'task_log') baseContent = { projects: aggregatedData.taskLog.projects };
    else if (secType === 'agent_activity') baseContent = { runs: aggregatedData.agentActivity.runs };
    else if (secType === 'invoice_summary') baseContent = aggregatedData.invoiceSummary as unknown as Record<string, unknown>;
    else if (secType === 'stalled_items') baseContent = { items: aggregatedData.stalledItems };
    return {
      section_type: secType,
      title: sectionTitleMap[secType] ?? secType,
      sort_order: index + 1,
      content: { ...baseContent, narrative: narratives[secType] ?? '' },
    };
  });

  const { data: member } = await supabase
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', workspaceId)
    .eq('role', 'owner')
    .limit(1)
    .single();

  const creatorUserId = member?.user_id ?? workspaceId;

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

  const preview = activeSections
    .slice(0, 3)
    .map((secType) => `${sectionTitleMap[secType] ?? secType}: ${narratives[secType] ?? ''}`)
    .join('\n\n');

  return {
    reportId,
    title: `Weekly Report Draft for ${client.name}`,
    confidence: 0.95,
    reasoning: 'Draft compiled accurately using pre-aggregated narrative prose.',
    riskLevel: 'low',
    preview,
  };
}
