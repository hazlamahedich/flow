-- Add rejection_reason column to draft_responses
-- Stores the user-provided reason when a draft is rejected

alter table draft_responses
  add column if not exists rejection_reason text
    constraint chk_rejection_reason_length check (rejection_reason is null or char_length(rejection_reason) <= 500);
