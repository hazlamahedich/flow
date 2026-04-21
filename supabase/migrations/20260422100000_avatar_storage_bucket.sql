-- Migration: Avatar storage bucket and RLS policies
-- Purpose: Private bucket for user avatar uploads
-- Related: Story 1.5 AC#4, #5, #6

INSERT INTO storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
VALUES (
  'avatars',
  'avatars',
  false,
  ARRAY['image/jpeg', 'image/png', 'image/webp'],
  2097152
) ON CONFLICT (id) DO NOTHING;

CREATE POLICY policy_avatars_select_self ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = split_part(name, '/', 1)
  );

CREATE POLICY policy_avatars_insert_self ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = split_part(name, '/', 1)
  );

CREATE POLICY policy_avatars_update_self ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = split_part(name, '/', 1)
  );

CREATE POLICY policy_avatars_delete_self ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = split_part(name, '/', 1)
  );
