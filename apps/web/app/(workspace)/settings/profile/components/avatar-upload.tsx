'use client';

import { useActionState, useRef, useEffect, useState } from 'react';
import type { UserProfile, ActionResult } from '@flow/types';

interface AvatarUploadProps {
  profile: UserProfile;
  uploadAction: (formData: FormData) => Promise<ActionResult<{ avatarUrl: string }>>;
  removeAction: () => Promise<ActionResult<void>>;
}

export function AvatarUpload({ profile, uploadAction, removeAction }: AvatarUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removeState, setRemoveState] = useState<ActionResult<void> | null>(null);

  const [uploadState, uploadFormAction, isUploading] = useActionState(
    async (_prev: ActionResult<{ avatarUrl: string }> | null, formData: FormData) => {
      setPreviewUrl(null);
      return uploadAction(formData);
    },
    null,
  );

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  }

  async function handleRemove() {
    const result = await removeAction();
    setRemoveState(result);
    if (result.success) {
      setPreviewUrl(null);
    }
  }

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const displayUrl = previewUrl ?? profile.avatarUrl;
  const errorMessage = !uploadState?.success && uploadState?.error?.message
    ? uploadState.error.message
    : !removeState?.success && removeState?.error?.message
      ? removeState.error.message
      : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        {displayUrl ? (
          <img
            src={displayUrl}
            alt="Avatar"
            className="h-20 w-20 rounded-full object-cover border border-[var(--flow-color-border-default)]"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--flow-color-bg-surface-raised)] border border-[var(--flow-color-border-default)]">
            <span className="text-2xl text-[var(--flow-color-text-muted)]">
              {profile.name?.[0]?.toUpperCase() ?? profile.email[0]?.toUpperCase() ?? '?'}
            </span>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <form>
            <input
              ref={fileInputRef}
              type="file"
              name="avatar"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                handleFileChange(e);
                if (e.target.form) {
                  const formData = new FormData(e.target.form);
                  uploadFormAction(formData);
                }
              }}
            />
            <button
              type="button"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center justify-center rounded-[var(--flow-radius-md)] border border-[var(--flow-color-border-default)] bg-transparent px-3 py-1.5 text-sm text-[var(--flow-color-text-primary)] hover:bg-[var(--flow-state-overlay-hover)] disabled:opacity-50"
            >
              {isUploading ? 'Uploading...' : 'Change avatar'}
            </button>
          </form>

          {profile.avatarUrl && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={isUploading}
              className="inline-flex items-center justify-center rounded-[var(--flow-radius-md)] px-3 py-1.5 text-sm text-[var(--flow-status-error)] hover:bg-[var(--flow-state-overlay-hover)] disabled:opacity-50"
            >
              Remove
            </button>
          )}
        </div>
      </div>

      {errorMessage && (
        <p className="text-sm text-[var(--flow-status-error)]">{errorMessage}</p>
      )}
    </div>
  );
}
