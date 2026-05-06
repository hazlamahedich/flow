import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { workspaces } from './workspaces';
import { clientInboxes } from './client-inboxes';
import { clients } from './clients';

export const emails = pgTable(
  'emails',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    clientInboxId: uuid('client_inbox_id')
      .notNull()
      .references(() => clientInboxes.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    gmailMessageId: text('gmail_message_id').notNull(),
    gmailThreadId: text('gmail_thread_id'),
    subject: text('subject'),
    fromAddress: text('from_address').notNull(),
    fromName: text('from_name'),
    toAddresses: jsonb('to_addresses').notNull().default([]),
    ccAddresses: jsonb('cc_addresses').notNull().default([]),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull(),
    bodyClean: text('body_clean'),
    bodyRawSafe: text('body_raw_safe'),
    headers: jsonb('headers'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_emails_workspace_gmail_message').on(table.workspaceId, table.gmailMessageId),
    index('idx_emails_workspace_inbox_received').on(table.workspaceId, table.clientInboxId, table.receivedAt),
    index('idx_emails_workspace_client_received').on(table.workspaceId, table.clientId, table.receivedAt),
    index('idx_emails_thread').on(table.workspaceId, table.gmailThreadId),
  ],
);
