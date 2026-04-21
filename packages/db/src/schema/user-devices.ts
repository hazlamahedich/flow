import { pgTable, uuid, text, timestamp, boolean, index, uniqueIndex } from 'drizzle-orm/pg-core';

export const userDevices = pgTable(
  'user_devices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    deviceTokenHash: text('device_token_hash').notNull(),
    label: text('label').notNull().default('New Device'),
    userAgentHint: text('user_agent_hint'),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    isRevoked: boolean('is_revoked').notNull().default(false),
  },
  (table) => [
    uniqueIndex('idx_user_devices_user_token_hash').on(table.userId, table.deviceTokenHash),
    index('idx_user_devices_user_id').on(table.userId),
  ],
);
