'use client';

import { useState, useEffect, useCallback } from 'react';

interface ClientOption {
  id: string;
  name: string;
  hasAccess: boolean;
}

interface ClientScopingDialogProps {
  userId: string;
  userName: string;
  clients?: ClientOption[];
  open: boolean;
  onClose: () => void;
}

export function ClientScopingDialog({
  userId,
  userName,
  clients: initialClients,
  open,
  onClose,
}: ClientScopingDialogProps) {
  const [search, setSearch] = useState('');
  const [clients, setClients] = useState<ClientOption[]>(initialClients ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = useCallback(() => {
    onClose();
    setError(null);
    setSearch('');
  }, [onClose]);

  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') handleClose();
  }, [handleClose]);

  useEffect(() => {
    if (open) {
      setError(null);
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [open, handleEscape]);

  if (!open) return null;

  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()),
  );

  async function handleToggle(clientId: string, currentlyHasAccess: boolean) {
    setSaving(true);
    setError(null);

    try {
      if (currentlyHasAccess) {
        const { revokeClientAccess } = await import('../actions/scope-client-access');
        const result = await revokeClientAccess({ userId, clientId });
        if (!result.success) {
          setError(result.error.message);
          return;
        }
      } else {
        const { grantClientAccess } = await import('../actions/scope-client-access');
        const result = await grantClientAccess({ userId, clientId });
        if (!result.success) {
          setError(result.error.message);
          return;
        }
      }

      setClients((prev) =>
        prev.map((c) =>
          c.id === clientId ? { ...c, hasAccess: !currentlyHasAccess } : c,
        ),
      );
    } catch {
      setError("Couldn't update client access. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
         onClick={handleClose}>
      <div
        className="w-full max-w-lg rounded-lg bg-[var(--flow-color-bg-primary)] p-6 shadow-lg"
        role="dialog"
        aria-label={`Client access for ${userName}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--flow-color-text-primary)]">
            Client Access — {userName}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close dialog"
            className="text-[var(--flow-color-text-secondary)] hover:text-[var(--flow-color-text-primary)]"
          >
            ✕
          </button>
        </div>

        {error && (
          <div role="alert" className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search clients..."
          className="w-full rounded-md border border-[var(--flow-color-border-default)] px-3 py-2 text-sm mb-4"
          aria-label="Search clients"
        />

        {clients.length === 0 ? (
          <p className="text-sm text-[var(--flow-color-text-secondary)]">
            No clients available. Clients are created in the Clients section.
          </p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-[var(--flow-color-text-secondary)]">
            No clients match your search.
          </p>
        ) : (
          <div className="max-h-64 overflow-y-auto space-y-2">
            {filtered.map((client) => (
              <label
                key={client.id}
                className="flex items-center gap-3 rounded-md border border-[var(--flow-color-border-default)] p-3 cursor-pointer hover:bg-[var(--flow-color-bg-secondary)]"
              >
                <input
                  type="checkbox"
                  checked={client.hasAccess}
                  onChange={() => handleToggle(client.id, client.hasAccess)}
                  disabled={saving}
                  aria-label={`${client.hasAccess ? 'Revoke' : 'Grant'} access to ${client.name}`}
                  className="rounded"
                />
                <span className="text-sm text-[var(--flow-color-text-primary)]">
                  {client.name}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
