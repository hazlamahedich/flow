'use client';

import { useActionState, useState } from 'react';
import type { ClientDeviceRecord } from '@flow/auth/device-types';
import { revokeDeviceAction } from '../actions/revoke-device';
import { revokeAllDevicesAction } from '../actions/revoke-all-devices';

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) return 'Just now';
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function DevicesList({ devices: initialDevices }: { devices: ClientDeviceRecord[] }) {
  const [devices, setDevices] = useState(initialDevices);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [showConfirmSignOut, setShowConfirmSignOut] = useState(false);
  const [signOutState, signOutAction, signOutPending] = useActionState(revokeAllDevicesAction, null);

  const activeDevices = devices.filter((d) => !d.isRevoked);
  const revokedDevices = devices.filter((d) => d.isRevoked);

  async function handleRevoke(deviceId: string) {
    setRevokingId(deviceId);
    const formData = new FormData();
    formData.set('deviceId', deviceId);

    try {
      const result = await revokeDeviceAction(null, formData);
      if (result.success) {
        setDevices((prev) =>
          prev.map((d) => (d.id === deviceId ? { ...d, isRevoked: true } : d)),
        );
      } else {
        setDevices((prev) =>
          prev.map((d) => (d.id === deviceId ? { ...d, isRevoked: true } : d)),
        );
      }
    } finally {
      setRevokingId(null);
    }
  }

  async function handleSignOutEverywhere() {
    setShowConfirmSignOut(false);
    await signOutAction();
    window.location.href = '/login?message=signed_out_everywhere';
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {activeDevices.length === 0 && (
          <p className="py-8 text-center text-sm text-[var(--flow-color-text-tertiary)]">
            No trusted devices. Trust a device during sign-in to stay signed in longer.
          </p>
        )}

        {activeDevices.map((device) => (
          <div
            key={device.id}
            className="flex items-center justify-between rounded-lg border border-[var(--flow-color-border-default)] bg-[var(--flow-color-bg-secondary)] px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[var(--flow-color-text-primary)]">
                {device.label}
              </p>
              <p className="mt-0.5 text-xs text-[var(--flow-color-text-tertiary)]">
                Last active {formatRelativeTime(device.lastSeenAt)}
              </p>
              {device.userAgentHint && (
                <p className="mt-0.5 truncate text-xs text-[var(--flow-color-text-tertiary)]">
                  {device.userAgentHint.slice(0, 80)}
                </p>
              )}
            </div>
            <button
              onClick={() => handleRevoke(device.id)}
              disabled={revokingId === device.id}
              className="ml-4 rounded-md border border-[var(--flow-color-border-default)] px-3 py-1.5 text-xs font-medium text-[var(--flow-color-text-secondary)] transition-opacity hover:border-red-300 hover:text-red-500 disabled:opacity-50"
            >
              {revokingId === device.id ? 'Revoking...' : 'Revoke'}
            </button>
          </div>
        ))}
      </div>

      {revokedDevices.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-sm text-[var(--flow-color-text-tertiary)] hover:text-[var(--flow-color-text-secondary)]">
            Revoked devices ({revokedDevices.length})
          </summary>
          <div className="mt-2 space-y-2">
            {revokedDevices.map((device) => (
              <div
                key={device.id}
                className="flex items-center justify-between rounded-lg border border-[var(--flow-color-border-default)] bg-[var(--flow-color-bg-secondary)] px-4 py-2 opacity-60"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-[var(--flow-color-text-primary)]">
                    {device.label}
                  </p>
                  <p className="text-xs text-[var(--flow-color-text-tertiary)]">
                    Revoked {formatRelativeTime(device.lastSeenAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      {activeDevices.length > 0 && (
        <div className="border-t border-[var(--flow-color-border-default)] pt-4">
          {!showConfirmSignOut ? (
            <button
              onClick={() => setShowConfirmSignOut(true)}
              className="rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition-opacity hover:bg-red-50"
            >
              Sign out everywhere
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-[var(--flow-color-text-secondary)]">
                This will revoke all trusted devices and sign you out of all sessions. You will need to sign in again.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleSignOutEverywhere}
                  disabled={signOutPending}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-opacity hover:bg-red-700 disabled:opacity-50"
                >
                  {signOutPending ? 'Signing out...' : 'Confirm sign out everywhere'}
                </button>
                <button
                  onClick={() => setShowConfirmSignOut(false)}
                  className="rounded-md border border-[var(--flow-color-border-default)] px-4 py-2 text-sm font-medium text-[var(--flow-color-text-secondary)]"
                >
                  Cancel
                </button>
              </div>
              {signOutState && !signOutState.success && (
                <p className="text-sm text-red-400" role="alert">
                  {signOutState.error.message}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
