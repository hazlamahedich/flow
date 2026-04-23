'use client';

import { useState } from 'react';

interface PendingInvitation {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  createdAt: string | null;
}

interface PendingInvitationsListProps {
  invitations: PendingInvitation[];
}

export function PendingInvitationsList({ invitations }: PendingInvitationsListProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleResend(invitationId: string) {
    setLoading(invitationId);
    setError(null);
    try {
      const { resendInvitation } = await import('../actions/resend-invitation');
      const result = await resendInvitation({ invitationId });
      if (!result.success) {
        setError(result.error.message);
      }
    } catch {
      setError("Couldn't complete the action. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  async function handleRevokeInvitation(invitationId: string) {
    setLoading(invitationId);
    setError(null);
    try {
      const { revokeInvitation } = await import('../actions/revoke-invitation');
      const result = await revokeInvitation({ invitationId });
      if (!result.success) {
        setError(result.error.message);
      }
    } catch {
      setError("Couldn't revoke the invitation. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <>
      {error && (
        <div role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700 mb-3">
          {error}
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden md:block">
        <table className="w-full text-sm" aria-label="Pending invitations table">
          <thead>
            <tr className="border-b border-[var(--flow-color-border-default)]">
              <th className="pb-2 text-left font-medium text-[var(--flow-color-text-secondary)]">Email</th>
              <th className="pb-2 text-left font-medium text-[var(--flow-color-text-secondary)]">Role</th>
              <th className="pb-2 text-left font-medium text-[var(--flow-color-text-secondary)]">Expires</th>
              <th className="pb-2 text-right font-medium text-[var(--flow-color-text-secondary)]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {invitations.map((inv) => (
              <tr key={inv.id} className="border-b border-[var(--flow-color-border-default)]">
                <td className="py-3 text-[var(--flow-color-text-primary)]">{inv.email}</td>
                <td className="py-3 capitalize text-[var(--flow-color-text-secondary)]">{inv.role}</td>
                <td className="py-3 text-[var(--flow-color-text-secondary)]">
                  {new Date(inv.expiresAt).toLocaleDateString()}
                </td>
                <td className="py-3 text-right space-x-2">
                  <button
                    type="button"
                    onClick={() => handleResend(inv.id)}
                    disabled={loading === inv.id}
                    className="rounded-md border border-[var(--flow-color-border-default)] px-3 py-1 text-xs font-medium text-[var(--flow-color-text-primary)] hover:bg-[var(--flow-color-bg-secondary)] disabled:opacity-50"
                  >
                    {loading === inv.id ? 'Sending...' : 'Resend'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRevokeInvitation(inv.id)}
                    disabled={loading === inv.id}
                    className="rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    Revoke
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {invitations.map((inv) => (
          <div
            key={inv.id}
            className="rounded-lg border border-[var(--flow-color-border-default)] p-4 space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-[var(--flow-color-text-primary)]">{inv.email}</div>
              <span className="capitalize text-xs text-[var(--flow-color-text-secondary)]">{inv.role}</span>
            </div>
            <div className="text-xs text-[var(--flow-color-text-secondary)]">
              Expires: {new Date(inv.expiresAt).toLocaleDateString()}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleResend(inv.id)}
                disabled={loading === inv.id}
                className="rounded-md border border-[var(--flow-color-border-default)] px-3 py-1 text-xs font-medium text-[var(--flow-color-text-primary)] hover:bg-[var(--flow-color-bg-secondary)] disabled:opacity-50"
              >
                {loading === inv.id ? 'Sending...' : 'Resend'}
              </button>
              <button
                type="button"
                onClick={() => handleRevokeInvitation(inv.id)}
                disabled={loading === inv.id}
                className="rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                Revoke
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
