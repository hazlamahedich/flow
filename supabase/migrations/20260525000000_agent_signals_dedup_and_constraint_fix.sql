-- Add dedup_key column for signal deduplication
ALTER TABLE agent_signals ADD COLUMN IF NOT EXISTS dedup_key TEXT;

-- Partial unique index for dedup_key (only non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_signals_dedup_key 
  ON agent_signals (dedup_key) 
  WHERE dedup_key IS NOT NULL;

-- Drop old signal_type CHECK constraint and replace with permissive one
-- Old: ^[a-z-]+\.[a-z]+\.[a-z]+$ (3 segments, no underscores)
-- New: 2-5 segments, allow lowercase, digits, underscores, hyphens
ALTER TABLE agent_signals DROP CONSTRAINT IF EXISTS agent_signals_signal_type_check;
ALTER TABLE agent_signals ADD CONSTRAINT agent_signals_signal_type_check 
  CHECK (signal_type ~ '^[a-z][a-z0-9_-]*(\.[a-z][a-z0-9_-]*){1,4}$');
