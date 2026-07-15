import { validatePortalSlug } from '@/lib/actions/portal/actions';
import { createPortalClient } from '@flow/auth/server/portal-client';
import { PORTAL_SESSION_MAX_AGE_SECONDS } from '@/lib/actions/portal/constants';
import { ZeroThoughtTasksHero } from '@/app/portal/components/ZeroThoughtTasksHero';
import { NextWeekPreview } from '@/app/portal/components/NextWeekPreview';
import { MessageVaCard } from '@/app/portal/components/MessageVaCard';

/**
 * Portal overview page (extended for 9-2).
 *
 * Story 9.2 — AC6, AC7 (UX-DR36, UX-DR39, UX-DR40).
 * Renders the hero metric, next-week preview, and message-VA card.
 */
export default async function PortalOverviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await validatePortalSlug(slug);
  if (!session) return null;

  const client = await createPortalClient(
    session,
    PORTAL_SESSION_MAX_AGE_SECONDS,
  );

  const now = new Date();
  const weekStart = getWeekStartUtc(now);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 7);

  const prevWeekStart = new Date(weekStart);
  prevWeekStart.setUTCDate(weekStart.getUTCDate() - 7);

  const { count: taskCount, error: countError } = await getZeroThoughtCount(
    client,
    session.workspaceId,
    session.clientId,
    weekStart,
    weekEnd,
  );
  const { count: prevWeekCount, error: prevCountError } =
    await getZeroThoughtCount(
      client,
      session.workspaceId,
      session.clientId,
      prevWeekStart,
      weekStart,
    );

  const nextWeekEnd = new Date(now);
  nextWeekEnd.setUTCDate(now.getUTCDate() + 7);

  const { data: upcomingEvents } = await client
    .from('calendar_events')
    .select('title, start_at')
    .eq('workspace_id', session.workspaceId)
    .eq('client_id', session.clientId)
    .gte('start_at', now.toISOString())
    .lte('start_at', nextWeekEnd.toISOString())
    .order('start_at', { ascending: true })
    .limit(5);

  return (
    <div className="px-4 py-6 max-w-4xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold text-[var(--flow-text-primary)]">
        Welcome
      </h1>

      <ZeroThoughtTasksHero
        count={countError ? 0 : (taskCount ?? 0)}
        previousWeekCount={prevCountError ? 0 : (prevWeekCount ?? 0)}
      />

      <NextWeekPreview
        events={(upcomingEvents ?? []).map((e: Record<string, unknown>) => ({
          title: e.title as string,
          startAt: String(e.start_at),
        }))}
      />

      <MessageVaCard />
    </div>
  );
}

function getWeekStartUtc(now: Date): Date {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const day = start.getUTCDay();
  start.setUTCDate(start.getUTCDate() - day);
  return start;
}

async function getZeroThoughtCount(
  client: Awaited<ReturnType<typeof createPortalClient>>,
  workspaceId: string,
  clientId: string,
  startDate: Date,
  endDate: Date,
): Promise<{ count: number; error: boolean }> {
  const { count, error } = await client
    .from('agent_signals')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('client_id', clientId)
    .gte('created_at', startDate.toISOString())
    .lt('created_at', endDate.toISOString());

  if (error) {
    return { count: 0, error: true };
  }

  return { count: count ?? 0, error: false };
}
