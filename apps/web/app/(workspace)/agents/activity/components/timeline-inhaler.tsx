'use client';

import { INHALER_TEMPLATES } from '../../constants/activity-copy';
import type { ActionHistoryFilters } from '@flow/db';

interface TimelineInhalerProps {
  totalCount: number;
  filteredCount: number;
  filters: ActionHistoryFilters;
}

export function TimelineInhaler({ totalCount, filteredCount, filters }: TimelineInhalerProps) {
  const hasFilters = filters.agentId || filters.status || filters.dateFrom || filters.dateTo || filters.clientId;
  const text = hasFilters
    ? INHALER_TEMPLATES.filtered(filteredCount, totalCount)
    : INHALER_TEMPLATES.summary(filteredCount, 0, 0);

  return (
    <p className="text-sm text-[var(--flow-color-text-secondary)]" aria-live="polite">
      {text}
    </p>
  );
}
