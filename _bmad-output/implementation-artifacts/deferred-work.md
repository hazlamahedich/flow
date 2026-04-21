# Deferred Work

## Deferred from: code review of 1-4a-workspace-schema-creation (2026-04-21)

- AC#2: `workspaces.name` and `workspace_members.updated_at` listed as "new columns" but may already exist from Story 1.2 — pre-existing schema ambiguity, verify in next migration
- `member_client_access.client_id` has no FK — deferred to Epic 3 (Story 3-1 creates clients table) — already documented in story
- `workspaceSchema.settings` is `z.record(z.unknown())` — no shape validation — deferred, settings schema TBD
- `workspace_audit.ts` — `workspace_created` event omits `createdBy` field — deferred, not blocking
