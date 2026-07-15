import { requireTenantContext } from '@flow/db';
import { getServerSupabase } from '@/lib/supabase-server';
import { Card, CardHeader, CardContent } from '@flow/ui';
import { ConnectCalendarButton } from './connect-calendar-button';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Calendar Integration',
};

export const dynamic = 'force-dynamic';

interface ConnectedCalendar {
  id: string;
  provider: string;
  calendar_id: string | null;
  calendar_name: string | null;
  email_address: string | null;
  access_type: string | null;
  sync_status: string | null;
  is_primary: boolean;
  last_sync_at: string | null;
}

export default async function CalendarIntegrationPage() {
  const supabase = await getServerSupabase();
  const ctx = await requireTenantContext(supabase);

  const { data: calendars, error: calendarsError } = await supabase
    .from('client_calendars')
    .select(
      'id, provider, calendar_id, calendar_name, email_address, access_type, sync_status, is_primary, last_sync_at',
    )
    .eq('workspace_id', ctx.workspaceId)
    .order('created_at', { ascending: false });

  const connectedCalendars: ConnectedCalendar[] = (calendars ?? []).map(
    (c) => ({
      id: c.id,
      provider: c.provider,
      calendar_id: c.calendar_id,
      calendar_name: c.calendar_name,
      email_address: c.email_address,
      access_type: c.access_type,
      sync_status: c.sync_status,
      is_primary: c.is_primary,
      last_sync_at: c.last_sync_at,
    }),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[var(--flow-color-text-primary)]">
          Calendar Integration
        </h1>
        {ctx.role !== 'member' && <ConnectCalendarButton />}
      </div>

      {calendarsError && (
        <p className="text-sm text-red-600" role="alert">
          Failed to load calendars. Please try again.
        </p>
      )}

      {connectedCalendars.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-[var(--flow-color-text-secondary)]">
              No calendars connected yet. Connect your Google Calendar to get
              started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {connectedCalendars.map((cal) => (
            <Card key={cal.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[var(--flow-color-text-primary)]">
                      {cal.calendar_name ?? 'Unnamed Calendar'}
                    </span>
                    {cal.is_primary && (
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                        Primary
                      </span>
                    )}
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      cal.sync_status === 'connected'
                        ? 'bg-green-100 text-green-700'
                        : cal.sync_status === 'error'
                          ? 'bg-red-100 text-red-700'
                          : cal.sync_status === 'syncing'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {cal.sync_status ?? 'unknown'}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-4 text-xs text-[var(--flow-color-text-secondary)]">
                  {cal.email_address && <span>{cal.email_address}</span>}
                  <span className="capitalize">
                    {cal.access_type?.replace('_', ' ') ?? 'unknown access'}
                  </span>
                  <span className="capitalize">
                    {cal.provider?.replace('_', ' ') ?? 'unknown provider'}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
