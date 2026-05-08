import { getHandledEmails } from '../actions/handled-quietly-actions';
import { HandledQuietlyItem } from './handled-quietly-item';
import { getServerSupabase } from '@/lib/supabase-server';

interface HandledQuietlySectionProps {
  workspaceId: string;
}

export async function HandledQuietlySection({ workspaceId }: HandledQuietlySectionProps) {
  const result = await getHandledEmails({ limit: 10, offset: 0 });

  if (!result.success || result.data.totalCount === 0) {
    return null;
  }

  const { items, totalCount } = result.data;

  return (
    <div className="mt-8 space-y-4" data-testid="handled-quietly-section">
      <div className="border-t-2 border-amber-500/40 my-6 flex items-center gap-4 pt-4" data-testid="handled-quietly-divider">
        <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-[var(--flow-color-gold)]/10 text-[var(--flow-color-gold)] text-xs font-medium">
          <span>Handled Quietly</span>
          <span className="flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-[var(--flow-color-gold)] text-white text-[10px]">
            {totalCount}
          </span>
        </div>
      </div>


      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((email) => (
          <HandledQuietlyItem key={email.id} email={email} />
        ))}
      </div>

      {totalCount > items.length && (
        <p className="text-center text-xs text-[var(--flow-color-text-secondary)] italic">
          Showing latest 10 items. Use weekly audit for full review.
        </p>
      )}
    </div>
  );
}
