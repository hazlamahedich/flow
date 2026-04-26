'use client';

interface ClientEmptyStateProps {
  variant: 'no-clients' | 'no-results' | 'no-assigned';
  onReset?: () => void;
}

export function ClientEmptyState({ variant, onReset }: ClientEmptyStateProps) {
  if (variant === 'no-assigned') {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--flow-color-border-default)] py-16">
        <p className="text-lg font-medium text-[var(--flow-color-text-primary)]">
          No clients assigned yet
        </p>
        <p className="mt-2 text-sm text-[var(--flow-color-text-secondary)]">
          Your team lead hasn&apos;t assigned you any clients yet. Ask them to grant you access.
        </p>
      </div>
    );
  }

  if (variant === 'no-results') {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--flow-color-border-default)] py-16">
        <p className="text-lg font-medium text-[var(--flow-color-text-primary)]">
          No clients match your filters
        </p>
        <p className="mt-2 text-sm text-[var(--flow-color-text-secondary)]">
          Try adjusting your search or filter criteria.
        </p>
        {onReset && (
          <button
            onClick={onReset}
            className="mt-4 text-sm font-medium text-[var(--flow-color-text-brand)] hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--flow-color-border-default)] py-16">
      <p className="text-lg font-medium text-[var(--flow-color-text-primary)]">
        Add your first client
      </p>
      <p className="mt-2 text-sm text-[var(--flow-color-text-secondary)]">
        Manage all your client info in one place — contact details, billing preferences, and notes.
      </p>
    </div>
  );
}
