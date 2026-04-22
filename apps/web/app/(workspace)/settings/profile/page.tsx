import { getServerSupabase } from '@/lib/supabase-server';
import { getUserProfile, ensureUserProfile } from '@flow/db';
import type { Metadata } from 'next';
import { ProfileEditForm } from './components/profile-edit-form';
import { EmailChangeForm } from './components/email-change-form';
import { EmailChangePendingBanner } from './components/email-change-pending-banner';
import type { UserProfile, ActionResult, PendingEmailChange } from '@flow/types';

export const metadata: Metadata = {
  title: 'Profile',
};

export const dynamic = 'force-dynamic';

async function handleUpdateProfile(input: unknown): Promise<ActionResult<UserProfile>> {
  'use server';
  const { updateProfile } = await import('./actions/update-profile');
  return updateProfile(input);
}

async function handleUploadAvatar(formData: FormData): Promise<ActionResult<{ avatarUrl: string }>> {
  'use server';
  const { uploadAvatar } = await import('./actions/upload-avatar');
  return uploadAvatar(formData);
}

async function handleRemoveAvatar(): Promise<ActionResult<void>> {
  'use server';
  const { removeAvatar } = await import('./actions/remove-avatar');
  return removeAvatar();
}

async function handleRequestEmailChange(input: unknown): Promise<ActionResult<{ pendingEmail: string }>> {
  'use server';
  const { requestEmailChange } = await import('./actions/request-email-change');
  return requestEmailChange(input);
}

async function handleCancelEmailChange(input: unknown): Promise<ActionResult<void>> {
  'use server';
  const { cancelEmailChange } = await import('./actions/cancel-email-change');
  return cancelEmailChange(input);
}

async function getPendingStatus(supabase: Awaited<ReturnType<typeof getServerSupabase>>, userId: string) {
  const { data } = await supabase
    .from('email_change_requests')
    .select('id, new_email, expires_at')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  return data;
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ email_error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  await ensureUserProfile(supabase, user.id, user.email ?? '');
  const profile = await getUserProfile(supabase, user.id);

  if (!profile) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-[var(--flow-color-text-primary)]">
          Profile
        </h1>
        <p className="text-sm text-red-600">Failed to load profile. Please try again.</p>
      </div>
    );
  }

  const pendingRow = await getPendingStatus(supabase, user.id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-[var(--flow-color-text-primary)]">
        Profile
      </h1>

      {params.email_error === 'expired' && (
        <p className="text-sm text-[var(--flow-status-error)]" role="alert">
          This verification link has expired. Please request a new email change.
        </p>
      )}

      {params.email_error === 'sync-failed' && (
        <p className="text-sm text-[var(--flow-status-error)]" role="alert">
          Something went wrong while updating your email. Please try again or contact support.
        </p>
      )}

      <ProfileEditForm
        profile={profile}
        updateAction={handleUpdateProfile}
        uploadAction={handleUploadAvatar}
        removeAction={handleRemoveAvatar}
      />

      <div className="space-y-1 pt-4 border-t border-[var(--flow-color-border-default)]">
        <h2 className="text-sm font-medium text-[var(--flow-color-text-secondary)]">
          Email
        </h2>

        {pendingRow ? (
          <EmailChangePendingBanner
            requestId={pendingRow.id}
            newEmail={pendingRow.new_email}
            expiresAt={pendingRow.expires_at}
            cancelAction={handleCancelEmailChange}
          />
        ) : (
          <EmailChangeForm requestAction={handleRequestEmailChange} />
        )}
      </div>
    </div>
  );
}
