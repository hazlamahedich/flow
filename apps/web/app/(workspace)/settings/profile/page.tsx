import { getServerSupabase } from '@/lib/supabase-server';
import { getUserProfile, ensureUserProfile } from '@flow/db';
import type { Metadata } from 'next';
import { ProfileEditForm } from './components/profile-edit-form';
import type { UserProfile, ActionResult } from '@flow/types';

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

export default async function ProfilePage() {
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-[var(--flow-color-text-primary)]">
        Profile
      </h1>
      <ProfileEditForm
        profile={profile}
        updateAction={handleUpdateProfile}
        uploadAction={handleUploadAvatar}
        removeAction={handleRemoveAvatar}
      />
    </div>
  );
}
