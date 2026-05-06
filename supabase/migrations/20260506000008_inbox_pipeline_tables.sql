-- Migration for Story 4.4a: Action Item Extraction & Draft Response Pipeline
-- Group A: Database Schema & Migrations (7 tables)

-- Task 1: Create extracted_actions table
CREATE TABLE IF NOT EXISTS extracted_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  client_inbox_id uuid NOT NULL,
  action_type text NOT NULL CHECK (action_type IN ('task', 'meeting', 'payment', 'deadline')),
  description text NOT NULL CHECK (length(description) BETWEEN 1 AND 500),
  due_date timestamptz,
  contact text,
  confidence float NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  soft_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_extracted_actions_workspace_client ON extracted_actions(workspace_id, client_inbox_id);
CREATE INDEX IF NOT EXISTS idx_extracted_actions_email ON extracted_actions(email_id);

ALTER TABLE extracted_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY policy_extracted_actions_all_member
  ON extracted_actions
  FOR ALL
  TO authenticated
  USING (
    workspace_id::text = auth.jwt()->>'workspace_id' AND
    client_inbox_id::text IN (
      SELECT id::text FROM client_inboxes 
      WHERE workspace_id::text = auth.jwt()->>'workspace_id'
    )
  )
  WITH CHECK (
    workspace_id::text = auth.jwt()->>'workspace_id' AND
    client_inbox_id::text IN (
      SELECT id::text FROM client_inboxes 
      WHERE workspace_id::text = auth.jwt()->>'workspace_id'
    )
  );

-- RLS enforces workspace_id and client_inbox_id; client_inbox_id isolation is defense-in-depth at application layer
-- (workspace_id is the primary RLS perimeter; client_inbox_id scoping provides granular tenant isolation)

CREATE POLICY policy_extracted_actions_service_role
  ON extracted_actions
  TO service_role
  USING (true)
  WITH CHECK (true);


-- Task 2: Create draft_responses table
CREATE TABLE IF NOT EXISTS draft_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  client_inbox_id uuid NOT NULL,
  draft_content text NOT NULL,
  voice_profile_id uuid, -- REFERENCES workspace_voice_profiles(id) added after table creation
  trust_at_generation smallint NOT NULL CHECK (trust_at_generation BETWEEN 1 AND 3),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','edited','superseded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_draft_responses_workspace_client ON draft_responses(workspace_id, client_inbox_id);
CREATE INDEX IF NOT EXISTS idx_draft_responses_email ON draft_responses(email_id);

ALTER TABLE draft_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY policy_draft_responses_all_member
  ON draft_responses
  FOR ALL
  TO authenticated
  USING (
    workspace_id::text = auth.jwt()->>'workspace_id' AND
    client_inbox_id::text IN (
      SELECT id::text FROM client_inboxes 
      WHERE workspace_id::text = auth.jwt()->>'workspace_id'
    )
  )
  WITH CHECK (
    workspace_id::text = auth.jwt()->>'workspace_id' AND
    client_inbox_id::text IN (
      SELECT id::text FROM client_inboxes 
      WHERE workspace_id::text = auth.jwt()->>'workspace_id'
    )
  );

CREATE POLICY policy_draft_responses_service_role
  ON draft_responses
  TO service_role
  USING (true)
  WITH CHECK (true);


-- Task 3: Create workspace_voice_profiles table
CREATE TABLE IF NOT EXISTS workspace_voice_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL UNIQUE,
  style_data jsonb NOT NULL DEFAULT '{"toneDescriptors":["professional","concise","helpful"],"avgSentenceLength":15,"formalityScore":7}',
  exemplar_emails text[] NOT NULL DEFAULT '{}',
  default_tone text NOT NULL DEFAULT 'professional' CHECK (default_tone IN ('casual','professional','formal')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE workspace_voice_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY policy_workspace_voice_profiles_all_member
  ON workspace_voice_profiles
  FOR ALL
  TO authenticated
  USING (workspace_id::text = auth.jwt()->>'workspace_id')
  WITH CHECK (workspace_id::text = auth.jwt()->>'workspace_id');

CREATE POLICY policy_workspace_voice_profiles_service_role
  ON workspace_voice_profiles
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add foreign key to draft_responses
ALTER TABLE draft_responses 
  ADD CONSTRAINT fk_draft_responses_voice_profile 
  FOREIGN KEY (voice_profile_id) REFERENCES workspace_voice_profiles(id);


-- Task 4: Create client_tone_overrides table
CREATE TABLE IF NOT EXISTS client_tone_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  client_id uuid NOT NULL,
  tone text NOT NULL CHECK (tone IN ('casual','professional','formal')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, client_id)
);

ALTER TABLE client_tone_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY policy_client_tone_overrides_all_member
  ON client_tone_overrides
  FOR ALL
  TO authenticated
  USING (workspace_id::text = auth.jwt()->>'workspace_id')
  WITH CHECK (workspace_id::text = auth.jwt()->>'workspace_id');

CREATE POLICY policy_client_tone_overrides_service_role
  ON client_tone_overrides
  TO service_role
  USING (true)
  WITH CHECK (true);


-- Task 5: Create inbox_trust_metrics table
CREATE TABLE IF NOT EXISTS inbox_trust_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  client_inbox_id uuid NOT NULL,
  metric_type text NOT NULL CHECK (metric_type IN ('recategorization_rate','draft_acceptance_rate')),
  metric_value float NOT NULL CHECK (metric_value BETWEEN 0 AND 1),
  sample_count integer NOT NULL CHECK (sample_count >= 0),
  computed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, client_inbox_id, metric_type)
);

ALTER TABLE inbox_trust_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY policy_inbox_trust_metrics_select_member
  ON inbox_trust_metrics
  FOR SELECT
  TO authenticated
  USING (workspace_id::text = auth.jwt()->>'workspace_id');

CREATE POLICY policy_inbox_trust_metrics_service_role
  ON inbox_trust_metrics
  TO service_role
  USING (true)
  WITH CHECK (true);


-- Task 6: Create recategorization_log table
-- Task 6: Create recategorization_log table
CREATE TABLE IF NOT EXISTS recategorization_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  client_inbox_id uuid NOT NULL, -- AC8: All new tables include client_inbox_id
  old_category text NOT NULL,
  new_category text NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recategorization_log_workspace ON recategorization_log(workspace_id, client_inbox_id);

ALTER TABLE recategorization_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY policy_recategorization_log_select_member
  ON recategorization_log
  FOR SELECT
  TO authenticated
  USING (
    workspace_id::text = auth.jwt()->>'workspace_id' AND
    client_inbox_id::text IN (
      SELECT id::text FROM client_inboxes 
      WHERE workspace_id::text = auth.jwt()->>'workspace_id'
    )
  );

CREATE POLICY policy_recategorization_log_insert_member
  ON recategorization_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    workspace_id::text = auth.jwt()->>'workspace_id' AND
    client_inbox_id::text IN (
      SELECT id::text FROM client_inboxes 
      WHERE workspace_id::text = auth.jwt()->>'workspace_id'
    )
  );


CREATE POLICY policy_recategorization_log_service_role
  ON recategorization_log
  TO service_role
  USING (true)
  WITH CHECK (true);


-- Task 7: Create email_processing_state table
CREATE TABLE IF NOT EXISTS email_processing_state (
  email_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  state text NOT NULL DEFAULT 'categorized' CHECK (state IN ('categorized','extraction_pending','extraction_complete','extraction_skipped','draft_pending','draft_complete','draft_deferred')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (email_id, workspace_id)
);

CREATE INDEX IF NOT EXISTS idx_email_processing_state_workspace ON email_processing_state(workspace_id, state);

ALTER TABLE email_processing_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY policy_email_processing_state_all_member
  ON email_processing_state
  FOR ALL
  TO authenticated
  USING (workspace_id::text = auth.jwt()->>'workspace_id')
  WITH CHECK (workspace_id::text = auth.jwt()->>'workspace_id');

CREATE POLICY policy_email_processing_state_service_role
  ON email_processing_state
  TO service_role
  USING (true)
  WITH CHECK (true);
