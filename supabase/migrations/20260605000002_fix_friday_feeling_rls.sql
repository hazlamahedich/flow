-- Security patch: restrict UPDATE on friday_feeling_summaries to dismissed_at only.
-- The original policy allowed any workspace member to UPDATE all columns (headline,
-- tasks_handled, etc.). Column-level privileges narrow this to the dismiss action only.

REVOKE UPDATE ON friday_feeling_summaries FROM authenticated;
GRANT UPDATE (dismissed_at) ON friday_feeling_summaries TO authenticated;

-- wednesday_affirmations UPDATE was already owner-only via RLS policy, but apply
-- the same column restriction for defence-in-depth.
REVOKE UPDATE ON wednesday_affirmations FROM authenticated;
GRANT UPDATE (dismissed_at) ON wednesday_affirmations TO authenticated;
