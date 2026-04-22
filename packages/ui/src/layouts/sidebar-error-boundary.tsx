'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface SidebarErrorBoundaryProps {
  children: ReactNode;
}

interface SidebarErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class SidebarErrorBoundary extends Component<
  SidebarErrorBoundaryProps,
  SidebarErrorBoundaryState
> {
  constructor(props: SidebarErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): SidebarErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(
      JSON.stringify({
        level: 'error',
        component: 'SidebarErrorBoundary',
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
      }),
    );
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          className="flex h-full w-[var(--flow-sidebar-collapsed)] items-center justify-center border-r border-[var(--flow-color-border-default)] bg-[var(--flow-color-bg-surface)] p-2 lg:w-[var(--flow-sidebar-expanded)]"
          role="alert"
          aria-live="polite"
        >
          <div className="text-center">
            <p className="text-xs text-[var(--flow-color-text-muted)]">
              Navigation unavailable
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-2 text-xs text-[var(--flow-color-text-secondary)] underline hover:text-[var(--flow-color-text-primary)]"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
