-- Trust transitions log: immutable record of all trust level changes
-- Related: Story 2.3 - Trust Matrix & Graduation System

CREATE TABLE trust_transitions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matrix_entry_id   UUID NOT NULL REFERENCES trust_matrix(id) ON DELETE CASCADE,
  workspace_id      UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  from_level        trust_level NOT NULL,
  to_level          trust_level NOT NULL,
  trigger_type      TEXT NOT NULL,
  trigger_reason    TEXT NOT NULL,
  is_context_shift  BOOLEAN NOT NULL DEFAULT false,
  snapshot          JSONB NOT NULL,
  actor             TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trust_transitions_entry ON trust_transitions(matrix_entry_id, created_at DESC);
CREATE INDEX idx_trust_transitions_workspace ON trust_transitions(workspace_id, created_at DESC);
