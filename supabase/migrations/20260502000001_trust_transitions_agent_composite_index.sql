-- Composite index for trust history audit queries (Story 2.6c)
-- idx_trust_transitions_workspace already exists on (workspace_id, created_at DESC)
-- idx_trust_transitions_entry already exists on (matrix_entry_id, created_at DESC)
-- This adds a dedicated index for agent-filtered queries that JOIN through matrix_entry_id

CREATE INDEX IF NOT EXISTS idx_trust_transitions_matrix_entry ON trust_transitions (matrix_entry_id);
