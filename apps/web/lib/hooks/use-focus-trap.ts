'use client';

import { useCallback, useEffect, useRef } from 'react';

interface UseFocusTrapReturn {
  containerRef: React.RefObject<HTMLDivElement | null>;
  activate: () => void;
  deactivate: () => void;
}

export function useFocusTrap(
  triggerElement?: HTMLElement | null,
): UseFocusTrapReturn {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const getFocusableElements = useCallback((): HTMLElement[] => {
    if (!containerRef.current) return [];
    const selectors = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ];
    return Array.from(
      containerRef.current.querySelectorAll<HTMLElement>(selectors.join(', ')),
    ).filter((el) => !el.hasAttribute('aria-hidden'));
  }, []);

  const activate = useCallback(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => {
      const focusable = getFocusableElements();
      if (focusable.length > 0 && focusable[0]) {
        focusable[0].focus();
      }
    });
  }, [getFocusableElements]);

  const deactivate = useCallback(() => {
    if (triggerElement) {
      triggerElement.focus();
    } else if (previouslyFocused.current) {
      previouslyFocused.current.focus();
    }
  }, [triggerElement]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusable = getFocusableElements();
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          if (last) last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          if (first) first.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [getFocusableElements]);

  return { containerRef, activate, deactivate };
}
