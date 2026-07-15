import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  check,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { workspaces } from './workspaces';
import { clients } from './clients';
import { sql } from 'drizzle-orm';

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    status: text('status').notNull().default('active'),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_projects_workspace_id').on(table.workspaceId),
    index('idx_projects_workspace_client').on(
      table.workspaceId,
      table.clientId,
    ),
    uniqueIndex('projects_unique_name_per_client').on(
      table.workspaceId,
      table.clientId,
      table.name,
    ),
    check('projects_status_check', sql`status IN ('active', 'archived')`),
    check(
      'projects_status_archived_at_check',
      sql`((status = 'archived' AND archived_at IS NOT NULL) OR (status = 'active' AND archived_at IS NULL))`,
    ),
  ],
);

export type ProjectStatus = 'active' | 'archived';
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
