import { faker } from '@faker-js/faker';

type EmailCategory = 'urgent' | 'action' | 'info' | 'noise';
type ProcessingState =
  | 'categorized'
  | 'extraction_pending'
  | 'extraction_complete'
  | 'extraction_skipped'
  | 'draft_pending'
  | 'draft_complete'
  | 'draft_deferred';

interface HandledItem {
  emailId: string;
  subject: string;
  sender: string;
  actionTaken: string;
  clientName: string;
}

interface NeedsAttentionItem {
  emailId: string;
  subject: string;
  sender: string;
  category: 'urgent' | 'action';
  reason: string;
  clientName: string;
}

interface ThreadSummary {
  threadKey: string;
  emailCount: number;
  summary: string;
  clientName: string;
}

interface ClientBreakdown {
  clientId: string;
  clientName: string;
  totalEmails: number;
  urgentCount: number;
  actionCount: number;
  handledCount: number;
}

interface MorningBriefProposal {
  summaryLine: string;
  handledItems: HandledItem[];
  needsAttentionItems: NeedsAttentionItem[];
  threadSummaries: ThreadSummary[];
  reassuranceMessage?: string;
  clientBreakdown: ClientBreakdown[];
  floodState?: boolean;
}

const FAKE_WORKSPACE_ID = '00000000-0000-4000-8000-000000000001';
const FAKE_CLIENT_ID = '00000000-0000-4000-8000-000000000002';
const FAKE_INBOX_ID = '00000000-0000-4000-8000-000000000003';
const FAKE_EMAIL_ID = '00000000-0000-4000-8000-000000000004';
const FAKE_USER_ID = '00000000-0000-4000-8000-000000000005';

export function createTestInbox(overrides?: Record<string, unknown>) {
  return {
    id: faker.string.uuid(),
    workspace_id: FAKE_WORKSPACE_ID,
    client_id: FAKE_CLIENT_ID,
    email_address: faker.internet.email(),
    provider: 'gmail' as const,
    access_type: 'direct' as const,
    sync_status: 'connected' as const,
    ...overrides,
  };
}

export function createTestEmail(overrides?: Record<string, unknown>) {
  return {
    id: faker.string.uuid(),
    workspace_id: FAKE_WORKSPACE_ID,
    client_inbox_id: FAKE_INBOX_ID,
    client_id: FAKE_CLIENT_ID,
    gmail_message_id: `msg-${faker.string.alphanumeric(16)}`,
    gmail_thread_id: `thread-${faker.string.alphanumeric(16)}`,
    subject: faker.lorem.sentence(),
    from_address: faker.internet.email(),
    from_name: faker.person.fullName(),
    to_addresses: [faker.internet.email()],
    cc_addresses: [] as string[],
    body_clean: faker.lorem.paragraphs(2),
    category: null as EmailCategory | null,
    confidence: null as number | null,
    received_at: new Date().toISOString(),
    ...overrides,
  };
}

export function createTestCategoryResult(overrides?: Record<string, unknown>) {
  return {
    category: 'action' as EmailCategory,
    confidence: 0.85,
    reasoning: 'Client requested action with clear deadline.',
    requires_confirmation: false,
    ...overrides,
  };
}

export function createTestActionItem(overrides?: Record<string, unknown>) {
  return {
    actionType: 'task',
    description: faker.lorem.sentence(),
    dueDate: null as string | null,
    contact: null as string | null,
    confidence: 0.9,
    ...overrides,
  };
}

export function createTestDraftResponse(overrides?: Record<string, unknown>) {
  return {
    id: faker.string.uuid(),
    email_id: FAKE_EMAIL_ID,
    workspace_id: FAKE_WORKSPACE_ID,
    client_inbox_id: FAKE_INBOX_ID,
    draft_content: faker.lorem.paragraphs(2),
    trust_at_generation: 2,
    status: 'pending' as const,
    ...overrides,
  };
}

export function createTestBriefProposal(
  overrides?: Partial<MorningBriefProposal>,
): MorningBriefProposal {
  return {
    summaryLine: 'You have 2 items needing attention and 15 handled quietly.',
    handledItems: [createTestHandledItem()],
    needsAttentionItems: [createTestNeedsAttentionItem()],
    threadSummaries: [],
    clientBreakdown: [createTestClientBreakdown()],
    ...overrides,
  };
}

export function createTestHandledItem(
  overrides?: Partial<HandledItem>,
): HandledItem {
  return {
    emailId: faker.string.uuid(),
    subject: faker.lorem.sentence(),
    sender: faker.internet.email(),
    actionTaken: 'categorized_as_info',
    clientName: faker.company.name(),
    ...overrides,
  };
}

export function createTestNeedsAttentionItem(
  overrides?: Partial<NeedsAttentionItem>,
): NeedsAttentionItem {
  return {
    emailId: faker.string.uuid(),
    subject: faker.lorem.sentence(),
    sender: faker.internet.email(),
    category: 'urgent',
    reason: 'Time-sensitive request from client.',
    clientName: faker.company.name(),
    ...overrides,
  };
}

export function createTestClientBreakdown(
  overrides?: Partial<ClientBreakdown>,
): ClientBreakdown {
  return {
    clientId: FAKE_CLIENT_ID,
    clientName: faker.company.name(),
    totalEmails: 10,
    urgentCount: 2,
    actionCount: 3,
    handledCount: 5,
    ...overrides,
  };
}

export function createTestThreadSummary(
  overrides?: Partial<ThreadSummary>,
): ThreadSummary {
  return {
    threadKey: `thread-${faker.string.alphanumeric(8)}`,
    emailCount: 3,
    summary: faker.lorem.sentence(),
    clientName: faker.company.name(),
    ...overrides,
  };
}

export function createTestProcessingState(overrides?: Record<string, unknown>) {
  return {
    emailId: FAKE_EMAIL_ID,
    workspaceId: FAKE_WORKSPACE_ID,
    state: 'categorized' as ProcessingState,
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

export {
  FAKE_WORKSPACE_ID,
  FAKE_CLIENT_ID,
  FAKE_INBOX_ID,
  FAKE_EMAIL_ID,
  FAKE_USER_ID,
};
