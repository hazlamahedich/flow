'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  MoreHorizontal,
  X,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { NAV_ITEMS } from './sidebar';

const PRIMARY_HREFS = ['/inbox', '/calendar'];
const OVERFLOW_HREFS = NAV_ITEMS.filter(
  (item) => !PRIMARY_HREFS.includes(item.href),
);

export function MobileTabBar() {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const firstSheetItemRef = useRef<HTMLAnchorElement>(null);

  const closeSheet = useCallback(() => {
    setSheetOpen(false);
    moreButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!sheetOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeSheet();
        return;
      }
      if (e.key === 'Tab' && sheetRef.current) {
        const focusable = sheetRef.current.querySelectorAll<HTMLElement>(
          'a[href], button, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first && last) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last && first) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    firstSheetItemRef.current?.focus();
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [sheetOpen, closeSheet]);

  return (
    <>
      <nav
        aria-label="Mobile navigation"
        className="fixed bottom-0 left-0 right-0 z-[var(--flow-z-sticky)] border-t border-[var(--flow-color-border-default)] bg-[var(--flow-color-bg-surface)] sm:hidden"
        data-testid="mobile-tab-bar"
      >
        <ul className="flex items-center justify-around" role="list">
          {NAV_ITEMS.filter((item) => PRIMARY_HREFS.includes(item.href)).map(({ href, label, Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + '/');
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  className={cn(
                    'flex flex-col items-center gap-1 py-2 text-[10px] transition-colors motion-reduce:transition-none',
                    isActive
                      ? 'text-[var(--flow-color-accent-gold)]'
                      : 'text-[var(--flow-color-text-tertiary)]',
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  <span>{label}</span>
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <button
              ref={moreButtonRef}
              type="button"
              onClick={() => setSheetOpen(true)}
              className="flex w-full flex-col items-center gap-1 py-2 text-[10px] text-[var(--flow-color-text-tertiary)]"
              aria-expanded={sheetOpen}
              aria-label="More navigation"
            >
              <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
              <span>More</span>
            </button>
          </li>
        </ul>
      </nav>

      {sheetOpen && (
        <>
          <div
            className="fixed inset-0 z-[var(--flow-z-overlay)] bg-black/50 sm:hidden"
            onClick={closeSheet}
            aria-hidden="true"
            data-testid="mobile-sheet-backdrop"
          />
          <div
            ref={sheetRef}
            className="fixed bottom-0 left-0 right-0 z-[var(--flow-z-overlay)] rounded-t-[var(--flow-radius-lg)] border-t border-[var(--flow-color-border-default)] bg-[var(--flow-color-bg-surface-raised)] p-4 sm:hidden"
            style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
            role="dialog"
            aria-label="More navigation"
            data-testid="mobile-bottom-sheet"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium text-[var(--flow-color-text-primary)]">
                More
              </span>
              <button
                type="button"
                onClick={closeSheet}
                className="rounded-[var(--flow-radius-sm)] p-1 text-[var(--flow-color-text-tertiary)] hover:text-[var(--flow-color-text-primary)]"
                aria-label="Close navigation"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="grid grid-cols-3 gap-3" role="list">
              {OVERFLOW_HREFS.map(({ href, label, Icon }, index) => {
                const isActive = pathname === href || pathname.startsWith(href + '/');
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      ref={index === 0 ? firstSheetItemRef : undefined}
                      onClick={closeSheet}
                      className={cn(
                        'flex flex-col items-center gap-2 rounded-[var(--flow-radius-md)] p-3 text-xs transition-colors motion-reduce:transition-none',
                        isActive
                          ? 'bg-[var(--flow-state-overlay-active)] text-[var(--flow-color-accent-gold)]'
                          : 'text-[var(--flow-color-text-secondary)] hover:bg-[var(--flow-state-overlay-hover)]',
                      )}
                    >
                      <Icon className="h-5 w-5" aria-hidden="true" />
                      <span>{label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </>
  );
}
