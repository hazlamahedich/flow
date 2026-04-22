'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAtom } from 'jotai';
import { commandPaletteOpenAtom } from '@flow/shared';
import { OverlayPriority } from '@flow/shared';
import type { SearchResult } from '@flow/types';
import { useReducedMotion } from '../../hooks/use-reduced-motion';
import { cn } from '../../lib/utils';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '../ui/command';
import { useFocusTrap } from '../../hooks/use-focus-trap';
import { useDebouncedCallback } from '../../hooks/use-debounced-callback';

interface CommandPaletteProps {
  searchAction: (query: string) => Promise<{ success: boolean; data?: SearchResult[]; error?: { message: string } }>;
  onNavigate: (href: string) => void;
}

const NAVIGATION_ITEMS = [
  { id: 'nav-home', label: 'Home', href: '/', group: 'Navigation' },
  { id: 'nav-clients', label: 'Clients', href: '/clients', group: 'Navigation' },
  { id: 'nav-invoices', label: 'Invoices', href: '/invoices', group: 'Navigation' },
  { id: 'nav-time', label: 'Time', href: '/time', group: 'Navigation' },
  { id: 'nav-settings', label: 'Settings', href: '/settings', group: 'Navigation' },
  { id: 'nav-agents', label: 'Agents', href: '/agents', group: 'Navigation' },
];

const ACTION_ITEMS = [
  { id: 'action-new-client', label: 'New Client', href: '/clients/new', group: 'Actions' },
  { id: 'action-new-invoice', label: 'New Invoice', href: '/invoices/new', group: 'Actions' },
  { id: 'action-start-timer', label: 'Start Timer', href: '/time?action=start', group: 'Actions' },
  { id: 'action-log-time', label: 'Log Time', href: '/time?action=log', group: 'Actions' },
  { id: 'action-search-clients', label: 'Search Clients…', href: '/clients', group: 'Actions' },
  { id: 'action-search-invoices', label: 'Search Invoices…', href: '/invoices', group: 'Actions' },
  { id: 'action-toggle-sidebar', label: 'Toggle Sidebar', href: '', group: 'Actions' },
  { id: 'action-shortcuts', label: 'Keyboard Shortcuts', href: '', group: 'Actions' },
  { id: 'action-inbox', label: 'Go to Inbox', href: '/inbox', group: 'Actions' },
];

export function CommandPalette({ searchAction, onNavigate }: CommandPaletteProps) {
  const [open, setOpen] = useAtom(commandPaletteOpenAtom);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [pendingQuery, setPendingQuery] = useState<string | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const reducedMotion = useReducedMotion();
  const { ref: trapRef } = useFocusTrap<HTMLDivElement>({ enabled: open });

  const debouncedSearch = useDebouncedCallback(
    async (args: unknown[]) => {
      const q = args[0] as string;
      if (!q.trim()) {
        setResults([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(false);
      setPendingQuery(q);
      try {
        const result = await searchAction(q);
        setPendingQuery((pending) => {
          if (pending === q) {
            if (result.success && result.data) {
              setResults(result.data);
            } else {
              setResults([]);
              setError(true);
            }
          }
          return pending;
        });
      } catch {
        setPendingQuery((pending) => {
          if (pending === q) {
            setResults([]);
            setError(true);
          }
          return pending;
        });
      } finally {
        setLoading(false);
      }
    },
    300,
  );

  const handleOpen = useCallback(() => {
    triggerRef.current = document.activeElement as HTMLElement;
    setOpen(true);
    setQuery('');
    setResults([]);
    setError(false);
    setLoading(false);
  }, [setOpen]);

  const handleClose = useCallback(() => {
    setOpen(false);
    setQuery('');
    setResults([]);
    debouncedSearch.cancel();
    setTimeout(() => {
      if (triggerRef.current?.isConnected) {
        triggerRef.current.focus();
      } else {
        document.body.focus();
      }
    }, 0);
  }, [setOpen, debouncedSearch]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, handleClose]);

  const handleQueryChange = useCallback(
    (value: string) => {
      setQuery(value);
      debouncedSearch([value]);
    },
    [debouncedSearch],
  );

  const handleSelect = useCallback(
    (href: string) => {
      handleClose();
      if (href) {
        onNavigate(href);
      }
    },
    [handleClose, onNavigate],
  );

  const localItems = useMemo(() => {
    if (!query) return [...NAVIGATION_ITEMS, ...ACTION_ITEMS];
    const q = query.toLowerCase();
    return [...NAVIGATION_ITEMS, ...ACTION_ITEMS].filter(
      (item) => item.label.toLowerCase().includes(q),
    );
  }, [query]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[var(--flow-z-overlay)]"
      role="dialog"
      aria-label="Command palette"
      aria-modal="true"
    >
      <div
        className="fixed inset-0 bg-black/50"
        onClick={handleClose}
        aria-hidden="true"
      />
      <div className="fixed left-1/2 top-[20%] w-full max-w-lg -translate-x-1/2">
        <div
          ref={trapRef}
          className={cn(
            'rounded-lg border border-[var(--flow-color-border-primary)] bg-[var(--flow-color-bg-surface-raised)] shadow-xl',
            reducedMotion
              ? ''
              : 'animate-in fade-in-0 zoom-in-95',
          )}
          style={{
            animationDuration: reducedMotion ? '0ms' : '150ms',
          }}
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Type a command or search..."
              value={query}
              onValueChange={handleQueryChange}
              data-testid="command-palette-input"
            />
            <CommandList>
              <CommandEmpty>
                {error ? 'Search failed. Try again.' : loading ? 'Searching...' : 'No results found. Try a different search.'}
              </CommandEmpty>
              {localItems.length > 0 && (
                <CommandGroup heading="Commands">
                  {localItems.map((item) => (
                    <CommandItem
                      key={item.id}
                      value={item.label}
                      onSelect={() => handleSelect(item.href)}
                    >
                      {item.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {results.length > 0 && (
                <CommandGroup heading="Search Results">
                  {results.map((result) => (
                    <CommandItem
                      key={result.id}
                      value={result.label}
                      onSelect={() => handleSelect(result.href)}
                    >
                      <span>{result.label}</span>
                      {result.description && (
                        <span className="ml-2 text-xs text-[var(--flow-color-text-tertiary)]">
                          {result.description}
                        </span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
          <div className="border-t border-[var(--flow-color-border-primary)] px-3 py-2 text-xs text-[var(--flow-color-text-tertiary)]">
            <span aria-live="polite">
              {loading ? 'Searching...' : results.length > 0 ? `${results.length} result${results.length !== 1 ? 's' : ''} found` : ''}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
