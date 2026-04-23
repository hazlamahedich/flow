import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { Provider } from 'jotai';
import { WorkspaceShell } from './workspace-shell';
import { resetShortcutRegistry } from '../components/command-palette/keyboard-listener';

vi.mock('next/navigation', () => ({
  usePathname: () => '/inbox',
}));

function mockLocalStorage() {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
    get length() { return Object.keys(store).length; },
    key: () => null,
  };
}

function renderShell(agentCount = 2) {
  return render(
    <Provider>
      <WorkspaceShell agentCount={agentCount}>
        <div data-testid="page-content">Page content</div>
      </WorkspaceShell>
    </Provider>,
  );
}

describe('WorkspaceShell', () => {
  beforeEach(() => {
    resetShortcutRegistry();
    const ls = mockLocalStorage();
    vi.stubGlobal('localStorage', ls);
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(pointer: fine)',
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }));
    vi.stubGlobal('sessionStorage', mockLocalStorage());
  });

  it('renders sidebar for agentCount >= 2', () => {
    const { container } = renderShell(2);
    expect(container.querySelector('[data-testid="sidebar"]')).not.toBeNull();
  });

  it('renders main content', () => {
    const { container } = renderShell(2);
    expect(container.querySelector('[data-testid="page-content"]')).not.toBeNull();
  });

  it('renders no sidebar for agentCount < 2', () => {
    const { container } = renderShell(1);
    expect(container.querySelector('[data-testid="sidebar"]')).toBeNull();
    expect(container.querySelector('[data-testid="page-content"]')).not.toBeNull();
  });

  it('renders no sidebar for agentCount = 0', () => {
    const { container } = renderShell(0);
    expect(container.querySelector('[data-testid="sidebar"]')).toBeNull();
  });

  it('has skip-to-content link', () => {
    const { container } = renderShell(2);
    const skipLink = container.querySelector('a[href="#main-content"]');
    expect(skipLink).not.toBeNull();
    expect(skipLink?.textContent).toContain('Skip to main content');
  });

  it('has main content element', () => {
    const { container } = renderShell(2);
    expect(container.querySelector('#main-content')).not.toBeNull();
  });

  it('has ARIA live region', () => {
    const { container } = renderShell(2);
    expect(container.querySelector('[aria-live="polite"]')).not.toBeNull();
  });

  it('keyboard shortcut ] announces sidebar expanded', async () => {
    const { container } = renderShell(2);
    await act(async () => {
      fireEvent.keyDown(document, { key: ']' });
    });
    const liveRegion = container.querySelector('[aria-live="polite"]');
    expect(liveRegion?.textContent).toBe('Sidebar expanded');
  });

  it('keyboard shortcut [ announces sidebar collapsed', async () => {
    const { container } = renderShell(2);
    await act(async () => {
      fireEvent.keyDown(document, { key: '[' });
    });
    const liveRegion = container.querySelector('[aria-live="polite"]');
    expect(liveRegion?.textContent).toBe('Sidebar collapsed');
  });

  it('keyboard shortcuts disabled in input', () => {
    const { container } = renderShell(2);
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    fireEvent.keyDown(input, { key: ']' });
    const liveRegion = container.querySelector('[aria-live="polite"]');
    expect(liveRegion?.textContent).toBe('');
    document.body.removeChild(input);
  });

  it('keyboard shortcuts disabled in textarea', () => {
    const { container } = renderShell(2);
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.focus();
    fireEvent.keyDown(textarea, { key: '[' });
    const liveRegion = container.querySelector('[aria-live="polite"]');
    expect(liveRegion?.textContent).toBe('');
    document.body.removeChild(textarea);
  });

  it('keyboard shortcuts disabled in contenteditable', () => {
    const { container } = renderShell(2);
    const div = document.createElement('div');
    div.setAttribute('contenteditable', 'true');
    document.body.appendChild(div);
    div.focus();
    fireEvent.keyDown(div, { key: ']' });
    const liveRegion = container.querySelector('[aria-live="polite"]');
    expect(liveRegion?.textContent).toBe('');
    document.body.removeChild(div);
  });

  it('keyboard shortcuts disabled with ctrl modifier', () => {
    const { container } = renderShell(2);
    fireEvent.keyDown(document, { key: ']', ctrlKey: true });
    const liveRegion = container.querySelector('[aria-live="polite"]');
    expect(liveRegion?.textContent).toBe('');
  });
});
