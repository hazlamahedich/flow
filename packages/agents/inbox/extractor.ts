import { createServiceClient } from '@flow/db';
import {
  createLLMRouter,
  tokenizePII,
  ContextBoundary,
  AgentExecutionContext,
} from '../shared/index.js';
import {
  extractionOutputSchema,
  ExtractionJobPayload,
  filterActionsByConfidence,
} from './schemas/extraction';
import { transitionState } from './state-machine';
import { meetsDraftGate } from './trust';
import { isFloodState } from './flood';
import { PgBossProducer } from '../orchestrator/pg-boss-producer.js';
import type { PgBoss } from 'pg-boss';

const EXTRACTION_SYSTEM_PROMPT = `
You are the Extraction Agent for Flow OS. Your task is to identify specific action items from email content.
Analyze the email and extract up to 5 items of the following types:
- task: A specific thing to do (e.g., "Schedule a call", "Send the report").
- meeting: A request or confirmation for a meeting or call.
- payment: A request for payment, an invoice, or a reminder to pay.
- deadline: A specific date or time something must be completed by.

Guidelines:
- Each item must have a specific verb and a clear description.
- Assign a confidence score (0.0 to 1.0) to each item.
- Only return items with a clear intention.
- Ignore quoted text or previous emails in a thread.

You must return a JSON object with:
{
  "actions": [
    {
      "actionType": "task" | "meeting" | "payment" | "deadline",
      "description": "brief description (max 500 chars)",
      "dueDate": "ISO 8601 timestamp or null",
      "contact": "person related to this action or null",
      "confidence": number
    }
  ]
}
`;

export async function extractionWorker(job: { data: ExtractionJobPayload }, boss: PgBoss) {
  const { emailId, workspaceId, clientInboxId } = job.data;
  const supabase = createServiceClient();
  const producer = new PgBossProducer(boss);
  const llmRouter = createLLMRouter();

  try {
    await transitionState(emailId, workspaceId, 'extraction_pending');

    const { data: email, error } = await supabase
      .from('emails')
      .select('subject, body_clean, client_id')
      .eq('id', emailId)
      .single();

    if (error || !email) throw new Error(`Email not found: ${emailId}`);

    const boundary = new ContextBoundary(email.client_id);

    // Strips quoted replies (> prefix lines)
    const sanitizedBody =
      email.body_clean
        ?.split('\n')
        .filter((line) => !line.trim().startsWith('>'))
        .join('\n') || '';

    // PII Tokenization
    const fullContent = `Subject: ${email.subject || '(No Subject)'}\n\n${sanitizedBody}`;
    const { text: tokenizedContent } = tokenizePII(fullContent, workspaceId);

    const wrappedContent = boundary.wrapContent(tokenizedContent, 'user_email_content');

    const executionContext: AgentExecutionContext = {
      workspaceId,
      agentId: 'inbox',
      correlationId: emailId,
    };

    const response = await llmRouter.complete(
      [
        { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
        { role: 'user', content: wrappedContent },
      ],
      executionContext,
      { taskTier: 'fast', temperature: 0.1 }
    );

    let result;
    try {
      const jsonStr = extractJsonObject(response.text);
      result = extractionOutputSchema.parse(JSON.parse(jsonStr));
    } catch (err) {
      console.error('[inbox] Extraction LLM output parse/validation failed. Raw response:', response.text, 'Error:', err);
      // Fail explicitly so the state machine doesn't mark it as complete
      throw new Error(`Extraction LLM output parse failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    const filteredActions = filterActionsByConfidence(result.actions).slice(0, 5);

    if (filteredActions.length > 0) {
      const { error: insertError } = await supabase.from('extracted_actions').insert(
        filteredActions.map((a) => ({
          email_id: emailId,
          workspace_id: workspaceId,
          client_inbox_id: clientInboxId,
          action_type: a.actionType,
          description: a.description,
          due_date: a.dueDate,
          contact: a.contact,
          confidence: a.confidence,
        }))
      );
      if (insertError) throw insertError;
    }

    await transitionState(emailId, workspaceId, 'extraction_complete');

    const trustPassed = await meetsDraftGate(workspaceId, clientInboxId);
    const floodState = await isFloodState(workspaceId);

    if (trustPassed) {
      if (floodState) {
        await transitionState(emailId, workspaceId, 'draft_deferred');
      } else {
        await transitionState(emailId, workspaceId, 'draft_pending');
        await producer.submit({
          agentId: 'inbox',
          actionType: 'generate_draft',
          input: {
            workspaceId,
            emailId,
            clientInboxId,
          },
          idempotencyKey: `draft:${emailId}`,
          correlationId: emailId,
        });
      }
    }
  } catch (error) {
    console.error(`[inbox] Extraction failed for email ${emailId}:`, error);
    throw error;
  }
}

function extractJsonObject(text: string): string {
  let depth = 0;
  let start = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (text[i] === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        return text.substring(start, i + 1);
      }
    }
  }
  throw new Error('[inbox] No JSON object found in LLM response');
}
