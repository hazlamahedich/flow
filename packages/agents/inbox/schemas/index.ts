/**
 * Schema-only barrel for the inbox agent.
 *
 * Importing from this file avoids pulling in heavy runtime dependencies
 * (e.g. DOMPurify / jsdom) when only types/schemas are needed.
 */
export {
  EMAIL_CATEGORIES,
  inboxInputSchema,
  inboxProposalSchema,
  morningBriefOutputSchema,
} from '../schemas';
export type {
  ClientBreakdown,
  EmailCategorizationInput,
  EmailCategory,
  EmailProcessingInput,
  HandledItem,
  InboxActionInput,
  InboxInput,
  InboxProposal,
  MorningBriefProposal,
  NeedsAttentionItem,
  ThreadSummary,
} from '../schemas';
