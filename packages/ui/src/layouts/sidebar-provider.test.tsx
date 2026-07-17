import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { Provider } from 'jotai';
import { SidebarProvider } from './sidebar-provider';

vi.mock('next/navigation', () => ({
  usePathname: () => '/inbox',
}));

vi.mock('sonner', () => ({
  toast: { info: vi.fn() },
}));

// Flush rendered components between tests so React scheduler microtasks
// don't fire after the jsdom environment tears down (causes flaky
// "window is not defined" unhandled-error failures). Matches the pattern
// in apps/web/__tests__/billing/9-5c-ui-notifications.spec.tsx.
afterEach(() => {
  cleanup();
});

function mockLocalStorage() {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      Object.keys(store).forEach((k) => delete store[k]);
    },
    get length() {
      return Object.keys(store).length;
    },
    key: () => null,
  };
}

function renderProvider(agentCount: number, collapsed = false) {
  return render(
    <Provider>
      <SidebarProvider
        agentCount={agentCount}
        collapsed={collapsed}
        onToggleCollapse={vi.fn()}
      />
    </Provider>,
  );
}

describe('SidebarProvider', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', mockLocalStorage());
    vi.stubGlobal('sessionStorage', mockLocalStorage());
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }));
  });

  it.each([0, 1])('renders no sidebar for agentCount = %d', (count) => {
    const { container } = renderProvider(count);
    expect(container.querySelector('[data-testid="sidebar"]')).toBeNull();
  });

  it.each([2, 3, 6])('renders sidebar for agentCount = %d', (count) => {
    const { container } = renderProvider(count);
    expect(container.querySelector('[data-testid="sidebar"]')).not.toBeNull();
  });
});
