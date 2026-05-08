'use client';

import { useState, useEffect, useRef } from 'react';
import { TimelineEvent } from '@flow/types';
import { TimelineFilterBar } from './TimelineFilterBar';
import { EmailTimelineItem } from './EmailTimelineItem';
import { AgentActionTimelineItem } from './AgentActionTimelineItem';
import { TimelineLoadMore } from './TimelineLoadMore';
import { getTimeline } from '../actions/timeline';

interface ClientTimelineProps {
  initialEvents: TimelineEvent[];
  initialCursor: string | null;
  workspaceId: string;
  clientId: string;
  eventType: 'all' | 'emails' | 'agent_runs';
  dateRange: string;
}

function computeDateFrom(dateRange: string): string | undefined {
  if (dateRange === 'all') return undefined;
  const days = parseInt(dateRange.replace('d', ''), 10);
  if (isNaN(days)) return undefined;
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString();
}

export function ClientTimeline({
  initialEvents,
  initialCursor,
  workspaceId,
  clientId,
  eventType,
  dateRange,
}: ClientTimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>(initialEvents);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  // Generation counter: incremented on filter reset to discard stale load-more responses
  const generationRef = useRef(0);

  useEffect(() => {
    generationRef.current += 1;
    setEvents(initialEvents);
    setCursor(initialCursor);
  }, [initialEvents, initialCursor]);

  const handleLoadMore = async () => {
    if (!cursor || isLoadingMore) return;

    const generation = generationRef.current;
    setIsLoadingMore(true);
    try {
      const dateFrom = computeDateFrom(dateRange);
      const dateTo = new Date().toISOString();

      const result = await getTimeline({
        workspaceId,
        clientId,
        eventType,
        dateFrom,
        dateTo,
        cursor,
        limit: 50,
      });

      if (generationRef.current !== generation) return;

      if (result.success) {
        setEvents((prev) => {
          const seen = new Set(prev.map((e) => `${e.kind}-${e.data.id}`));
          return [...prev, ...result.data.events.filter((e) => !seen.has(`${e.kind}-${e.data.id}`))];
        });
        setCursor(result.data.nextCursor);
      }
    } catch (error) {
      console.error('Failed to load more timeline events', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  return (
    <div className="mt-12">
      <TimelineFilterBar />

      <div className="relative">
        {events.length > 0 && (
          <div className="absolute left-[15px] top-2 bottom-0 w-0.5 bg-slate-200" />
        )}

        <div className="space-y-0">
          {events.length === 0 ? (
            <div className="py-20 text-center bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
              <p className="text-slate-500 font-medium">No communication history yet for this client.</p>
            </div>
          ) : (
            events.map((event, index) => {
              const key = `${event.kind}-${event.data.id}`;
              if (event.kind === 'email') {
                return (
                  <div key={key} data-testid="timeline-item">
                    <EmailTimelineItem
                      email={event.data}
                      workspaceId={workspaceId}
                      clientId={clientId}
                    />
                  </div>
                );
              } else {
                return (
                  <div key={key} data-testid="timeline-item">
                    <AgentActionTimelineItem
                      run={event.data}
                    />
                  </div>
                );
              }
            })
          )}
        </div>
      </div>

      <div className="mt-4 flex justify-center">
        <TimelineLoadMore
          onLoadMore={handleLoadMore}
          isLoading={isLoadingMore}
          hasMore={!!cursor}
        />
      </div>
    </div>
  );
}
