'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import {
  Inbox,
  Calendar,
  Bot,
  Users,
  FileText,
  Clock,
  BarChart3,
  Settings,
  MoreHorizontal,
  X,
} from 'lucide-react';
import { cn } from '../lib/utils';

const PRIMARY_TABS = [
  { href: '/inbox', label: 'Inbox', Icon: Inbox },
  { href: '/calendar', label: 'Calendar', Icon: Calendar },
] as const;

const OVERFLOW_ITEMS = [
  { href: '/agents', label: 'Agents', Icon: Bot },
  { href: '/clients', label: 'Clients', Icon: Users },
  { href: '/invoices', label: 'Invoices', Icon: FileText },
  { href: '/time', label: 'Time', Icon: Clock },
  { href: '/reports', label: 'Reports', Icon: BarChart3 },
  { href: '/settings', label: 'Settings', Icon: Settings },
] as const;

export function MobileTabBar() {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);
  const moreButtonRef = useRef<HTMLButtonElement>(null);

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
      }
    };

    document.addEventListener('keydown', handleKeyDown);
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
          {PRIMARY_TABS.map(({ href, label, Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + '/');
            return (
              <li key={href} className="flex-1">
                <a
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
                </a>
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
            className="fixed bottom-0 left-0 right-0 z-[var(--flow-z-overlay)] rounded-t-[var(--flow-radius-lg)] border-t border-[var(--flow-color-border-default)] bg-[var(--flow-color-bg-surface-raised)] p-4 pb-safe sm:hidden"
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
              {OVERFLOW_ITEMS.map(({ href, label, Icon }) => {
                const isActive = pathname === href || pathname.startsWith(href + '/');
                return (
                  <li key={href}>
                    <a
                      href={href}
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
                    </a>
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
