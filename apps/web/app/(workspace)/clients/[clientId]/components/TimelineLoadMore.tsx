'use client';

import { Button } from '@flow/ui';
import { Loader2 } from 'lucide-react';

interface TimelineLoadMoreProps {
  onLoadMore: () => void;
  isLoading: boolean;
  hasMore: boolean;
}

export function TimelineLoadMore({ onLoadMore, isLoading, hasMore }: TimelineLoadMoreProps) {
  if (!hasMore) return null;

  return (
    <div className="flex justify-center mt-8 pb-12">
      <Button
        variant="outline"
        onClick={onLoadMore}
        disabled={isLoading}
        className="min-w-[140px] border-[var(--flow-border-default)] text-[var(--flow-text-secondary)] hover:text-[var(--flow-text-primary)]"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading...
          </>
        ) : (
          'Load More'
        )}
      </Button>
    </div>
  );
}
