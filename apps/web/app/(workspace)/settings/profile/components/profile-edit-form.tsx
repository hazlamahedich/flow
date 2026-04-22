'use client';

import { useActionState, useState } from 'react';
import type { UserProfile, ActionResult } from '@flow/types';
import { AvatarUpload } from './avatar-upload';
import { TimezoneSelect } from './timezone-select';

interface ProfileEditFormProps {
  profile: UserProfile;
  updateAction: (input: unknown) => Promise<ActionResult<UserProfile>>;
  uploadAction: (formData: FormData) => Promise<ActionResult<{ avatarUrl: string }>>;
  removeAction: () => Promise<ActionResult<void>>;
}

export function ProfileEditForm({ profile, updateAction, uploadAction, removeAction }: ProfileEditFormProps) {
  const [selectedTimezone, setSelectedTimezone] = useState<string | null>(null);

  const [state, submitAction, isPending] = useActionState(
    async (prev: ActionResult<UserProfile> | null, formData: FormData) => {
      const name = String(formData.get('name') ?? '');
      const timezone = String(formData.get('timezone') ?? '');
      return updateAction({ name, timezone });
    },
    null,
  );

  const currentProfile = state?.success ? state.data : profile;
  const errorMessage = state && !state.success ? state.error.message : null;
  const displayTimezone = selectedTimezone ?? currentProfile.timezone;

  return (
    <div className="space-y-8">
      <AvatarUpload profile={currentProfile} uploadAction={uploadAction} removeAction={removeAction} />

      <form action={submitAction} className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="profile-name" className="text-sm font-medium text-[var(--flow-color-text-primary)]">
            Display name
          </label>
          <input
            id="profile-name"
            name="name"
            type="text"
            defaultValue={currentProfile.name ?? ''}
            maxLength={100}
            placeholder="Your display name"
            className="flex h-10 w-full max-w-md rounded-[var(--flow-radius-md)] border border-[var(--flow-color-border-default)] bg-transparent px-3 py-2 text-sm text-[var(--flow-color-text-primary)] placeholder:text-[var(--flow-color-text-muted)] focus-visible:outline-none focus-visible:ring-[var(--flow-focus-ring-width)] focus-visible:ring-offset-[var(--flow-focus-ring-offset)] focus-visible:ring-[var(--flow-focus-ring-color)]"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="profile-timezone" className="text-sm font-medium text-[var(--flow-color-text-primary)]">
            Timezone
          </label>
          <input type="hidden" name="timezone" value={displayTimezone} />
          <div className="max-w-md">
            <TimezoneSelect
              value={displayTimezone}
              onChange={setSelectedTimezone}
            />
          </div>
          <p className="text-xs text-[var(--flow-color-text-muted)]">
            Currently: {currentProfile.timezone}
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-[var(--flow-color-text-secondary)]">Email</label>
          <p className="text-sm text-[var(--flow-color-text-primary)]">{currentProfile.email}</p>
          <p className="text-xs text-[var(--flow-color-text-muted)]">
            Email changes are handled separately.
          </p>
        </div>

        {errorMessage && (
          <p className="text-sm text-[var(--flow-status-error)]">{errorMessage}</p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center justify-center rounded-[var(--flow-radius-md)] bg-[var(--flow-accent-primary)] px-4 py-2 text-sm font-medium text-[var(--flow-accent-primary-text)] hover:brightness-[var(--flow-state-hover-brightness)] disabled:opacity-50"
        >
          {isPending ? 'Saving...' : 'Save changes'}
        </button>
      </form>
    </div>
  );
}
