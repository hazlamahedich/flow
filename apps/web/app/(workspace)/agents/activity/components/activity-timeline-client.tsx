'use client';

import { useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import type { ActionHistoryRow, ActionHistoryFilters } from '@flow/db';
import { ActivityFilters } from './activity-filters';
import { TimelineInhaler } from './timeline-inhaler';
import { TimelineList } from './timeline-list';

interface ActivityTimelineClientProps {
  initialData: ActionHistoryRow[];
  totalCount: number;
  filters: ActionHistoryFilters;
  workspaceId: string;
  userId: string;
}

export function ActivityTimelineClient({
  initialData,
  totalCount,
  filters,
  workspaceId,
  userId,
}: ActivityTimelineClientProps) {
  const [grouped, setGrouped] = useState(false);
  const searchParams = useSearchParams();

  const handleToggleGrouped = useCallback(() => {
    setGrouped((prev) => !prev);
  }, []);

  return (
    <div className="space-y-4" aria-keyshortcuts="f g">
      <ActivityFilters filters={filters} totalCount={totalCount} />
      <TimelineInhaler totalCount={totalCount} filteredCount={initialData.length} filters={filters} />
      <TimelineList
        entries={initialData}
        totalCount={totalCount}
        filters={filters}
        grouped={grouped}
        onToggleGrouped={handleToggleGrouped}
        workspaceId={workspaceId}
        userId={userId}
        searchParamsStr={searchParams.toString()}
      />
    </div>
  );
}
