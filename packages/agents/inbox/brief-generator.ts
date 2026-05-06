import { createLLMRouter } from '../shared/llm-router';
import { morningBriefOutputSchema, type MorningBriefProposal } from './schemas';
import type { MorningBriefContext } from './brief-context';

const LLM_TIMEOUT_MS = 8000;
const MAX_RETRIES = 2;

function stripMarkdownFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*\n?/m, '')
    .replace(/\n?\s*```\s*$/m, '');
}

interface BriefGenerationResult {
  brief: MorningBriefProposal;
  isFallback: boolean;
}

export async function generateBrief(context: MorningBriefContext): Promise<BriefGenerationResult> {
  const router = createLLMRouter();

  if (!context.hasEmails && context.rawGroups.length === 0) {
    const summaryLine = context.hasInboxes
      ? 'All clear — your agents handled everything overnight.'
      : 'No inboxes connected yet.';
    return {
      isFallback: false,
      brief: {
        summaryLine,
        handledItems: [],
        needsAttentionItems: [],
        threadSummaries: [],
        ...(context.hasInboxes ? { reassuranceMessage: summaryLine } : {}),
        clientBreakdown: [],
      },
    };
  }

  const systemPrompt = `You are an expert executive assistant specializing in email triage and daily briefing.
Your goal is to generate a concise "Morning Brief" summarizing overnight activity.

Follow these rules strictly:
1. SUMMARY LINE FIRST: Start with a single summaryLine field that captures the overall state.
2. HANDLED BEFORE ATTENTION: Always list handledItems before needsAttentionItems in your response structure.
3. THREAD SUMMARIES: Provide a one-sentence summary for any thread with >3 emails.
4. CLIENT BREAKDOWN: Include a breakdown of activity per client.
5. ISOLATION: Never mix data from different clients in the same summary or description.
6. FORMAT: Respond ONLY with a valid JSON object. No markdown fences, no commentary.
7. EMPTY STATES: If there are no emails needing attention, use the reassuranceMessage field.

Output a JSON object with keys: summaryLine (string), handledItems (array), needsAttentionItems (array), threadSummaries (array), reassuranceMessage (optional string), clientBreakdown (array).`;

  const userPrompt = `Generate a Morning Brief for the following workspace activity since ${context.since.toISOString()}.

Context:
${context.rawGroups.map((g) => `
### Client: ${g.clientName} (ID: ${g.clientId})
Emails:
${g.emails.map((e) => `- ID: ${e.id}, Subject: ${e.subject}, Sender: ${e.sender}, Category: ${e.category ?? 'uncategorized'}`).join('\n')}
`).join('\n')}

Threads requiring summary:
${context.threadSummaries.map((t) => `- Thread Key: ${t.threadKey}, Email Count: ${t.emailCount}, Client: ${t.clientName}`).join('\n')}

${!context.hasEmails ? 'REASSURANCE: No emails found. All clear.' : ''}
${!context.hasInboxes ? 'REASSURANCE: No inboxes connected.' : ''}`;

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: userPrompt },
  ];

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

    try {
      const response = await router.complete(messages, {
        workspaceId: context.workspaceId,
        agentId: 'inbox',
      }, {
        taskTier: 'fast',
        maxTokens: 2048,
        temperature: attempt === 0 ? 0.1 : 0.3,
        abortSignal: controller.signal,
      });

      clearTimeout(timeoutId);

      const cleanText = stripMarkdownFences(response.text);
      const parsed = morningBriefOutputSchema.safeParse(JSON.parse(cleanText));
      if (parsed.success) {
        return { brief: parsed.data as MorningBriefProposal, isFallback: false };
      }

      console.error('Zod parse failure on attempt %d:', attempt + 1, parsed.error);
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('LLM generation attempt %d failed:', attempt + 1, error);
    }
  }

  return {
    brief: {
      summaryLine: 'Technical issue generating today\'s brief.',
      handledItems: [],
      needsAttentionItems: [],
      threadSummaries: [],
      reassuranceMessage: 'Technical issue generating today\'s brief — retrying shortly.',
      clientBreakdown: context.clientBreakdown || [],
    },
    isFallback: true,
  };
}
