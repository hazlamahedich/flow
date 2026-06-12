-- Story 5.4: Time Integrity Agent — signal storage
-- Purpose: Immutable anomaly records from daily integrity sweep (Epic 7 query key via affected_entry_ids)

CREATE TABLE time_integrity_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  sweep_date date NOT NULL,
  anomaly_type text NOT NULL CHECK (anomaly_type IN ('gap', 'overlap', 'low-hours')),
  affected_entry_ids uuid[] NOT NULL DEFAULT '{}',
  -- signal_key encodes anomaly_type + sorted affected_entry_ids for idempotency
  -- computed in application layer: [anomaly_type, ...sortedIds].join(':')
  signal_key text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  resolved_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_signal_per_day UNIQUE (workspace_id, sweep_date, signal_key)
);

CREATE INDEX idx_tis_workspace ON time_integrity_signals (workspace_id);
CREATE INDEX idx_tis_sweep_date ON time_integrity_signals (workspace_id, sweep_date);

ALTER TABLE time_integrity_signals ENABLE ROW LEVEL SECURITY;

-- Members can view signals in their workspace
CREATE POLICY "Members can view integrity signals in workspace"
  ON time_integrity_signals FOR SELECT
  USING (
    workspace_id::text IN (
      SELECT wm.workspace_id::text
      FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

-- INSERT/UPDATE only via service role (sweep uses service role key — RLS bypassed)
-- Application-layer workspace_id predicate is mandatory and tested (see Story 5.4 AC10)

-- Unauthenticated access denied
CREATE POLICY "Unauthenticated denied from integrity signals"
  ON time_integrity_signals FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);
