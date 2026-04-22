'use client';

interface WelcomeCardProps {
  name: string | null;
}

export function WelcomeCard({ name }: WelcomeCardProps) {
  const displayName = name ?? 'there';

  return (
    <div className="rounded-[var(--flow-radius-lg)] border border-[var(--flow-color-border)] p-6">
      <p className="text-lg font-medium text-[var(--flow-color-foreground)]">
        Welcome to your workspace, {displayName}. Your Inbox Agent is learning
        your style.
      </p>
      <div className="mt-4 space-y-1">
        <p className="text-sm text-[var(--flow-color-muted-foreground)]">
          First Client Added ✓
        </p>
        <p className="text-sm text-[var(--flow-color-muted-foreground)]">
          First Time Logged ✓
        </p>
      </div>
    </div>
  );
}
