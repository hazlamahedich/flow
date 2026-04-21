'use client';

import { useState, useEffect, useCallback } from 'react';

interface InviteFormProps {
  actorRole: string;
  currentEmail: string;
}

export function InviteForm({ actorRole, currentEmail }: InviteFormProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'member'>('member');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      setError(null);
    }
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [open, handleEscape]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (email.toLowerCase() === currentEmail.toLowerCase()) {
      setError("You can't invite yourself.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const { inviteMember } = await import('../actions/invite-member');
      const result = await inviteMember({ email, role });

      if (!result.success) {
        setError(result.error.message);
      } else {
        setEmail('');
        setOpen(false);
      }
    } catch {
      setError("Couldn't complete the action. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-[var(--flow-color-bg-primary)] px-4 py-2 text-sm font-medium text-[var(--flow-color-text-primary)] border border-[var(--flow-color-border-default)] hover:bg-[var(--flow-color-bg-secondary)]"
      >
        Invite Member
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 md:relative md:inset-auto md:bg-transparent"
         onClick={() => { setOpen(false); setError(null); }}>
      <div
        className="w-full max-w-md rounded-lg bg-[var(--flow-color-bg-primary)] p-6 shadow-lg md:border md:border-[var(--flow-color-border-default)]"
        role="dialog"
        aria-label="Invite a team member"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-[var(--flow-color-text-primary)] mb-4">
          Invite a Team Member
        </h2>

        {error && (
          <div role="alert" className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="invite-email" className="block text-sm font-medium text-[var(--flow-color-text-secondary)] mb-1">
              Email
            </label>
            <input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-md border border-[var(--flow-color-border-default)] px-3 py-2 text-sm"
              placeholder="colleague@example.com"
            />
          </div>

          <div>
            <label htmlFor="invite-role" className="block text-sm font-medium text-[var(--flow-color-text-secondary)] mb-1">
              Role
            </label>
            <select
              id="invite-role"
              value={role}
              onChange={(e) => {
                const v = e.target.value;
                if (v === 'admin' || v === 'member') setRole(v);
              }}
              className="w-full rounded-md border border-[var(--flow-color-border-default)] px-3 py-2 text-sm"
            >
              <option value="member">Member</option>
              {actorRole === 'owner' && <option value="admin">Admin</option>}
            </select>
          </div>

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={() => { setOpen(false); setError(null); }}
              className="rounded-md border border-[var(--flow-color-border-default)] px-4 py-2 text-sm font-medium text-[var(--flow-color-text-primary)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-[var(--flow-color-bg-primary)] px-4 py-2 text-sm font-medium border border-[var(--flow-color-border-default)] disabled:opacity-50"
            >
              {submitting ? 'Sending...' : 'Send Invitation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
