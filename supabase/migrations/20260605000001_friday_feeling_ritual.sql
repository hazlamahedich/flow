-- Story 8-4: Friday Feeling Ritual — database schema
-- Creates: friday_feeling_summaries, wednesday_affirmations, is_agency on workspaces
-- RLS policies for tenant isolation

-- ───────────────────────────────────────────────────────────────
-- 1. Add is_agency to workspaces
-- ───────────────────────────────────────────────────────────────
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS is_agency boolean NOT NULL DEFAULT false;

-- ───────────────────────────────────────────────────────────────
-- 2. friday_feeling_summaries
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS friday_feeling_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  week_end date NOT NULL,
  headline text NOT NULL,
  tasks_handled integer NOT NULL CHECK (tasks_handled >= 0),
  time_saved_minutes integer NOT NULL CHECK (time_saved_minutes >= 0),
  trust_milestones jsonb NOT NULL DEFAULT '[]',
  generated_at timestamptz NOT NULL DEFAULT now(),
  dismissed_at timestamptz,

  UNIQUE(workspace_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_ff_summaries_workspace ON friday_feeling_summaries(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ff_summaries_active ON friday_feeling_summaries(workspace_id, generated_at DESC) WHERE dismissed_at IS NULL;

ALTER TABLE friday_feeling_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ff_summaries_select" ON friday_feeling_summaries
  FOR SELECT USING (
    workspace_id::text = (auth.jwt()->>'workspace_id')
  );

CREATE POLICY "ff_summaries_update" ON friday_feeling_summaries
  FOR UPDATE USING (
    workspace_id::text = (auth.jwt()->>'workspace_id')
  );

CREATE POLICY "ff_summaries_insert" ON friday_feeling_summaries
  FOR INSERT WITH CHECK (
    auth.role() = 'service_role'
  );

CREATE POLICY "ff_summaries_service_all" ON friday_feeling_summaries
  FOR ALL USING (
    auth.role() = 'service_role'
  );

-- ───────────────────────────────────────────────────────────────
-- 3. wednesday_affirmations
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wednesday_affirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  team_member_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  story text NOT NULL,
  milestone jsonb NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  dismissed_at timestamptz
);

CREATE UNIQUE INDEX idx_wa_unique_per_day ON wednesday_affirmations (workspace_id, team_member_id, (timezone('UTC', generated_at)::date));

CREATE INDEX IF NOT EXISTS idx_wa_workspace ON wednesday_affirmations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_wa_active ON wednesday_affirmations(workspace_id, generated_at DESC) WHERE dismissed_at IS NULL;

ALTER TABLE wednesday_affirmations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_select_owner" ON wednesday_affirmations
  FOR SELECT USING (
    workspace_id::text = (auth.jwt()->>'workspace_id')
    AND (auth.jwt()->>'role') = 'owner'
  );

CREATE POLICY "wa_update_owner" ON wednesday_affirmations
  FOR UPDATE USING (
    workspace_id::text = (auth.jwt()->>'workspace_id')
    AND (auth.jwt()->>'role') = 'owner'
  );

CREATE POLICY "wa_insert_service" ON wednesday_affirmations
  FOR INSERT WITH CHECK (
    auth.role() = 'service_role'
  );

CREATE POLICY "wa_service_all" ON wednesday_affirmations
  FOR ALL USING (
    auth.role() = 'service_role'
  );

-- ───────────────────────────────────────────────────────────────
-- 4. Register friday-feeling agent
-- ───────────────────────────────────────────────────────────────
INSERT INTO agent_configurations (workspace_id, agent_id, status, schedule)
SELECT w.id, 'friday-feeling', 'active', '{"dayOfWeek": 5, "time": "16:00"}'::jsonb
FROM workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM agent_configurations ac
  WHERE ac.workspace_id = w.id AND ac.agent_id = 'friday-feeling'
)
ON CONFLICT DO NOTHING;
