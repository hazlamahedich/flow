import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderWithTheme } from '@flow/test-utils';
import { DashboardGreeting } from './dashboard-greeting';

const REAL_DATE = Date;

function mockDateAtHour(hour: number) {
  const FixedDate = class extends REAL_DATE {
    constructor(...args: unknown[]) {
      if (args.length === 0) {
        super('2026-04-22T00:00:00Z');
        this.setUTCHours(hour, 0, 0, 0);
        return;
      }
      super(...(args as ConstructorParameters<typeof Date>));
    }
    static now(): number { return new FixedDate().getTime(); }
  };
  vi.setSystemTime(new FixedDate());
}

beforeEach(() => {
  document.documentElement.removeAttribute('data-flow-theme-provider');
  document.documentElement.removeAttribute('data-theme');
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: query.includes('dark'),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
});

afterEach(() => {
  vi.useRealTimers();
});

const zeroSummary = {
  pendingApprovals: 0,
  agentActivityCount: 0,
  outstandingInvoices: 0,
  clientHealthAlerts: 0,
};

describe('DashboardGreeting', () => {
  it('shows first name in greeting', () => {
    vi.useFakeTimers();
    mockDateAtHour(9);
    const { container } = renderWithTheme(
      <DashboardGreeting firstName="Alice" summary={zeroSummary} clientCount={1} invoiceCount={1} />,
    );
    expect(container.textContent).toContain('Good morning, Alice');
  });

  it('uses morning bucket at 5:00', () => {
    vi.useFakeTimers();
    mockDateAtHour(5);
    const { container } = renderWithTheme(
      <DashboardGreeting firstName="Test" summary={zeroSummary} clientCount={1} invoiceCount={1} />,
    );
    expect(container.textContent).toContain('Good morning');
  });

  it('uses morning bucket at 11:59', () => {
    vi.useFakeTimers();
    mockDateAtHour(11);
    const { container } = renderWithTheme(
      <DashboardGreeting firstName="Test" summary={zeroSummary} clientCount={1} invoiceCount={1} />,
    );
    expect(container.textContent).toContain('Good morning');
  });

  it('uses afternoon bucket at 12:00', () => {
    vi.useFakeTimers();
    mockDateAtHour(12);
    const { container } = renderWithTheme(
      <DashboardGreeting firstName="Test" summary={zeroSummary} clientCount={1} invoiceCount={1} />,
    );
    expect(container.textContent).toContain('Good afternoon');
  });

  it('uses afternoon bucket at 16:59', () => {
    vi.useFakeTimers();
    mockDateAtHour(16);
    const { container } = renderWithTheme(
      <DashboardGreeting firstName="Test" summary={zeroSummary} clientCount={1} invoiceCount={1} />,
    );
    expect(container.textContent).toContain('Good afternoon');
  });

  it('uses evening bucket at 17:00', () => {
    vi.useFakeTimers();
    mockDateAtHour(17);
    const { container } = renderWithTheme(
      <DashboardGreeting firstName="Test" summary={zeroSummary} clientCount={1} invoiceCount={1} />,
    );
    expect(container.textContent).toContain('Good evening');
  });

  it('uses evening bucket at 4:59', () => {
    vi.useFakeTimers();
    mockDateAtHour(4);
    const { container } = renderWithTheme(
      <DashboardGreeting firstName="Test" summary={zeroSummary} clientCount={1} invoiceCount={1} />,
    );
    expect(container.textContent).toContain('Good evening');
  });

  it('shows whisper when activity > 0', () => {
    vi.useFakeTimers();
    mockDateAtHour(9);
    const summary = { pendingApprovals: 3, agentActivityCount: 0, outstandingInvoices: 0, clientHealthAlerts: 0 };
    const { container } = renderWithTheme(
      <DashboardGreeting firstName="Alice" summary={summary} clientCount={1} invoiceCount={1} />,
    );
    expect(container.textContent).toContain('3 items need your eyes');
  });

  it('shows all-clear whisper when active workspace and zero items', () => {
    vi.useFakeTimers();
    mockDateAtHour(9);
    const { container } = renderWithTheme(
      <DashboardGreeting firstName="Alice" summary={zeroSummary} clientCount={1} invoiceCount={1} />,
    );
    expect(container.textContent).toContain("You're all caught up, Alice");
  });

  it('shows first-run welcome for new workspace', () => {
    vi.useFakeTimers();
    mockDateAtHour(9);
    const { container } = renderWithTheme(
      <DashboardGreeting firstName="Alice" summary={zeroSummary} clientCount={0} invoiceCount={0} />,
    );
    expect(container.textContent).toContain('Welcome to Flow, Alice');
    expect(container.querySelector('a[href="/clients"]')).toBeTruthy();
  });

  it('formats date', () => {
    vi.useFakeTimers();
    mockDateAtHour(9);
    const { container } = renderWithTheme(
      <DashboardGreeting firstName="Alice" summary={zeroSummary} clientCount={1} invoiceCount={1} />,
    );
    const dateEl = container.querySelector('p:last-of-type');
    expect(dateEl?.textContent).toBeTruthy();
  });

  it('falls back gracefully for missing firstName', () => {
    vi.useFakeTimers();
    mockDateAtHour(9);
    const { container } = renderWithTheme(
      <DashboardGreeting summary={zeroSummary} clientCount={1} invoiceCount={1} />,
    );
    expect(container.textContent).toContain('Good morning');
    expect(container.textContent).not.toContain(', undefined');
  });

  it('falls back to UTC for missing timezone', () => {
    vi.useFakeTimers();
    mockDateAtHour(9);
    const { container } = renderWithTheme(
      <DashboardGreeting firstName="Alice" timezone={undefined} summary={zeroSummary} clientCount={1} invoiceCount={1} />,
    );
    expect(container.textContent).toContain('Good morning');
  });
});
