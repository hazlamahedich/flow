'use client';

import { useState } from 'react';

interface SessionDevice {
  id: string;
  userId: string;
  label: string;
  userAgentHint: string;
  lastSeenAt: string;
}

interface SessionsListProps {
  devices: SessionDevice[];
  memberCount: number;
}

export function SessionsList({ devices, memberCount }: SessionsListProps) {
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRevoke(deviceId: string) {
    setRevokingId(deviceId);
    setError(null);

    try {
      const { revokeSession } = await import('../actions/revoke-session');
      const result = await revokeSession({ deviceId });

      if (!result.success) {
        setError(result.error.message);
      }
    } catch {
      setError("Couldn't complete the action. Please try again.");
    } finally {
      setRevokingId(null);
    }
  }

  if (devices.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-[var(--flow-color-text-primary)]">
          Active Sessions
        </h1>
        <p className="text-sm text-[var(--flow-color-text-secondary)]">
          {`No other active sessions right now. You have ${memberCount} team member${memberCount === 1 ? '' : 's'}.`}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-[var(--flow-color-text-primary)]">
        Active Sessions
      </h1>

      {error && (
        <div role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden md:block">
        <table className="w-full text-sm" aria-label="Active sessions table">
          <thead>
            <tr className="border-b border-[var(--flow-color-border-default)]">
              <th className="pb-2 text-left font-medium text-[var(--flow-color-text-secondary)]">Device</th>
              <th className="pb-2 text-left font-medium text-[var(--flow-color-text-secondary)]">Last Seen</th>
              <th className="pb-2 text-right font-medium text-[var(--flow-color-text-secondary)]">Action</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((device) => (
              <tr key={device.id} className="border-b border-[var(--flow-color-border-default)]">
                <td className="py-3">
                  <div className="font-medium text-[var(--flow-color-text-primary)]">{device.label}</div>
                  {device.userAgentHint && (
                    <div className="text-xs text-[var(--flow-color-text-secondary)]">{device.userAgentHint}</div>
                  )}
                </td>
                <td className="py-3 text-[var(--flow-color-text-secondary)]">
                  {new Date(device.lastSeenAt).toLocaleDateString()}
                </td>
                <td className="py-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleRevoke(device.id)}
                    disabled={revokingId === device.id}
                    aria-label={`Revoke session for ${device.label}`}
                    className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {revokingId === device.id ? 'Revoking...' : 'Revoke'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {devices.map((device) => (
          <div
            key={device.id}
            className="rounded-lg border border-[var(--flow-color-border-default)] p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-[var(--flow-color-text-primary)]">{device.label}</div>
                {device.userAgentHint && (
                  <div className="text-xs text-[var(--flow-color-text-secondary)]">{device.userAgentHint}</div>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleRevoke(device.id)}
                disabled={revokingId === device.id}
                aria-label={`Revoke session for ${device.label}`}
                className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {revokingId === device.id ? 'Revoking...' : 'Revoke'}
              </button>
            </div>
            <div className="text-xs text-[var(--flow-color-text-secondary)]">
              Last seen: {new Date(device.lastSeenAt).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
