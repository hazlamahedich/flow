import { z } from 'zod';

export const EMAIL_CATEGORIES = ['urgent', 'action', 'info', 'noise'] as const;
export type EmailCategory = (typeof EMAIL_CATEGORIES)[number];

export interface InboxInput {
  workspaceId: string;
  signalId: string;
}

export interface InboxProposal {
  category: EmailCategory;
  confidence: number;
  reasoning: string;
  requires_confirmation: boolean;
  fallback?: boolean;
}

export interface EmailProcessingInput {
  workspaceId: string;
  signalId: string;
  actionType: 'email_processing';
  payloadId: string;
  clientInboxId: string;
}

export interface EmailCategorizationInput {
  workspaceId: string;
  signalId: string;
  actionType: 'email_categorization';
  emailId: string;
  clientId?: string;
  runId?: string;
}

export interface MorningBriefActionInput {
  workspaceId: string;
  signalId: string;
  actionType: 'morning_brief_generation';
  triggerEventId?: string;
}

export type InboxActionInput =
  | EmailProcessingInput
  | EmailCategorizationInput
  | MorningBriefActionInput;

export interface HandledItem {
  emailId: string;
  subject: string;
  sender: string;
  actionTaken: string;
  clientName: string;
}

export interface NeedsAttentionItem {
  emailId: string;
  subject: string;
  sender: string;
  category: 'urgent' | 'action';
  reason: string;
  clientName: string;
}

export interface ThreadSummary {
  threadKey: string;
  emailCount: number;
  summary: string;
  clientName: string;
}

export interface ClientBreakdown {
  clientId: string;
  clientName: string;
  totalEmails: number;
  urgentCount: number;
  actionCount: number;
  handledCount: number;
}

export interface MorningBriefProposal {
  summaryLine: string;
  handledItems: HandledItem[];
  needsAttentionItems: NeedsAttentionItem[];
  threadSummaries: ThreadSummary[];
  reassuranceMessage?: string;
  clientBreakdown: ClientBreakdown[];
  floodState?: boolean;
}

export const inboxInputSchema = z.object({
  workspaceId: z.string().uuid(),
  signalId: z.string().uuid(),
});

export const inboxProposalSchema = z.object({
  category: z.enum(EMAIL_CATEGORIES),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

export const morningBriefOutputSchema = z.object({
  summaryLine: z.string().min(1),
  handledItems: z.array(
    z.object({
      emailId: z.string().uuid(),
      subject: z.string(),
      sender: z.string(),
      actionTaken: z.string(),
      clientName: z.string(),
    })
  ),
  needsAttentionItems: z.array(
    z.object({
      emailId: z.string().uuid(),
      subject: z.string(),
      sender: z.string(),
      category: z.enum(['urgent', 'action']),
      reason: z.string(),
      clientName: z.string(),
    })
  ),
  threadSummaries: z.array(
    z.object({
      threadKey: z.string(),
      emailCount: z.number(),
      summary: z.string(),
      clientName: z.string(),
    })
  ),
  reassuranceMessage: z.string().optional(),
  clientBreakdown: z.array(
    z.object({
      clientId: z.string().uuid(),
      clientName: z.string(),
      totalEmails: z.number(),
      urgentCount: z.number(),
      actionCount: z.number(),
      handledCount: z.number(),
    })
  ),
  floodState: z.boolean().optional(),
});

// See schemas/ directory for pipeline-specific types (extraction, draft, trust, etc.)
