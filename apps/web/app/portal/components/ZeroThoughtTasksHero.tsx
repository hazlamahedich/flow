'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Zero-Thought Tasks hero metric (UX-DR36).
 *
 * Animated count-up showing the number of agent-handled tasks for the client
 * this week. Gold accent (--portal-accent) is used for non-text emphasis only
 * (WCAG AA). Respects prefers-reduced-motion.
 *
 * Story 9.2 — AC6.
 */
type HeroState = 'counting' | 'static' | 'trending' | 'empty' | 'stillness';

interface ZeroThoughtTasksHeroProps {
  count: number;
  previousWeekCount?: number;
  yesterdayCount?: number;
}

export function ZeroThoughtTasksHero({
  count,
  previousWeekCount,
  yesterdayCount,
}: ZeroThoughtTasksHeroProps) {
  const [displayCount, setDisplayCount] = useState(0);
  const [state, setState] = useState<HeroState>('counting');
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (count === 0) {
      setState('empty');
      setDisplayCount(0);
      return;
    }

    if (typeof window === 'undefined') {
      setDisplayCount(count);
      setState('static');
      return;
    }

    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (media.matches) {
      setDisplayCount(count);
      setState('static');
      return;
    }

    const duration = 1200;
    const startTime = performance.now();
    const startVal = 0;
    const endVal = count;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayCount(Math.round(startVal + (endVal - startVal) * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        if (previousWeekCount !== undefined && count > previousWeekCount) {
          setState('trending');
        } else if (
          yesterdayCount !== undefined &&
          count === yesterdayCount &&
          count > 0
        ) {
          setState('stillness');
        } else {
          setState('static');
        }
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    const handleMotionChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        cancelAnimationFrame(rafRef.current);
        setDisplayCount(count);
        setState('static');
      }
    };
    media.addEventListener('change', handleMotionChange);

    return () => {
      cancelAnimationFrame(rafRef.current);
      media.removeEventListener('change', handleMotionChange);
    };
  }, [count, previousWeekCount, yesterdayCount]);

  if (state === 'empty') {
    return (
      <div className="p-6 rounded-xl border border-[var(--flow-border-default)] text-center">
        <p className="text-sm text-[var(--flow-text-muted)]">
          Your first report arrives Friday.
        </p>
      </div>
    );
  }

  const trendArrow =
    state === 'trending' &&
    previousWeekCount !== undefined &&
    count > previousWeekCount;

  return (
    <div className="p-6 rounded-xl border border-[var(--flow-border-default)]">
      <p className="text-sm text-[var(--flow-text-muted)] mb-1">
        Zero-thought tasks this week
      </p>
      <div className="flex items-baseline gap-2">
        <span
          className="text-4xl font-bold"
          style={{ color: 'var(--flow-text-primary)' }}
        >
          {displayCount}
        </span>
        {trendArrow && (
          <span
            className="text-xl"
            style={{ color: 'var(--portal-accent)' }}
            role="img"
            aria-label="trending up"
          >
            &#9650;
          </span>
        )}
      </div>
      {state === 'stillness' && (
        <p className="mt-1 text-xs text-[var(--flow-text-muted)]">
          Same as yesterday
        </p>
      )}
    </div>
  );
}
