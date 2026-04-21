'use client';

import { useActionState, useState, useEffect } from 'react';
import { nameDevice } from '../actions/name-device';

interface DeviceNamingPromptProps {
  deviceId: string;
  userAgent?: string;
  onComplete: () => void;
}

export function DeviceNamingPrompt({ deviceId, userAgent, onComplete }: DeviceNamingPromptProps) {
  const defaultLabel = parseUserAgentSafe(userAgent);
  const [label, setLabel] = useState(defaultLabel);
  const [state, formAction, isPending] = useActionState(nameDevice, null);
  const [skipped, setSkipped] = useState(false);

  useEffect(() => {
    if (state?.success || skipped) {
      onComplete();
    }
  }, [state, skipped, onComplete]);

  if (skipped) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-lg bg-[var(--flow-color-bg-primary)] p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-[var(--flow-color-text-primary)]">
          Name this device
        </h2>
        <p className="mt-1 text-sm text-[var(--flow-color-text-secondary)]">
          We&apos;ll remember this device. Give it a name so you can manage it later.
        </p>

        <form
          action={(formData: FormData) => {
            formData.set('deviceId', deviceId);
            formAction(formData);
          }}
          className="mt-4 space-y-4"
        >
          <div>
            <label
              htmlFor="device-label"
              className="mb-1 block text-sm font-medium text-[var(--flow-color-text-secondary)]"
            >
              Device name
            </label>
            <input
              id="device-label"
              name="label"
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={100}
              className="w-full rounded-md border border-[var(--flow-color-border-default)] bg-[var(--flow-color-bg-secondary)] px-3 py-2 text-sm text-[var(--flow-color-text-primary)] focus:border-[var(--flow-color-accent-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--flow-color-accent-primary)]"
            />
          </div>

          {state && !state.success && (
            <p className="text-sm text-red-400" role="alert">
              {state.error.message}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isPending || !label.trim()}
              className="flex-1 rounded-md bg-[var(--flow-color-accent-primary)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? 'Saving...' : 'Save name'}
            </button>
            <button
              type="button"
              onClick={() => setSkipped(true)}
              className="rounded-md border border-[var(--flow-color-border-default)] px-4 py-2 text-sm text-[var(--flow-color-text-secondary)] transition-opacity hover:opacity-80"
            >
              Skip
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function parseUserAgentSafe(ua: string | undefined): string {
  if (!ua) return 'Unknown Device';

  if (ua.includes('Firefox/')) {
    const m = ua.match(/Firefox\/(\d+)/);
    if (ua.includes('Mac')) return `Firefox${m ? ` ${m[1]}` : ''} on macOS`;
    if (ua.includes('Windows')) return `Firefox${m ? ` ${m[1]}` : ''} on Windows`;
    return `Firefox${m ? ` ${m[1]}` : ''}`;
  }
  if (ua.includes('Edg/')) {
    const m = ua.match(/Edg\/(\d+)/);
    if (ua.includes('Mac')) return `Edge${m ? ` ${m[1]}` : ''} on macOS`;
    return `Edge${m ? ` ${m[1]}` : ''}`;
  }
  if (ua.includes('Chrome/')) {
    const m = ua.match(/Chrome\/(\d+)/);
    if (ua.includes('Mac')) return `Chrome${m ? ` ${m[1]}` : ''} on macOS`;
    if (ua.includes('Windows')) return `Chrome${m ? ` ${m[1]}` : ''} on Windows`;
    return `Chrome${m ? ` ${m[1]}` : ''}`;
  }
  if (ua.includes('Safari/') && !ua.includes('Chrome')) {
    const m = ua.match(/Version\/(\d+)/);
    if (ua.includes('iPhone')) return 'Safari on iPhone';
    if (ua.includes('iPad')) return 'Safari on iPad';
    return `Safari${m ? ` ${m[1]}` : ''} on macOS`;
  }
  return 'Unknown Device';
}
