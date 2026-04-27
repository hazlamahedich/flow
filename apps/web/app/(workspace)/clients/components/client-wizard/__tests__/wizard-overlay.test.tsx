import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ThemeProvider } from '@flow/tokens/providers';

vi.mock('../wizard-container', () => ({
  WizardContainer: () => <div data-testid="wizard-mock">Wizard</div>,
}));

vi.mock('@flow/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@flow/ui')>();
  return {
    ...actual,
    Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) => open ? <div data-testid="dialog">{children}</div> : null,
    DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
    DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
    DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  };
});

import { WizardOverlay } from '../wizard-overlay';

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider defaultTheme="dark">{ui}</ThemeProvider>);
}

describe('WizardOverlay', () => {
  afterEach(cleanup);

  it('renders when open', () => {
    const { getByTestId } = renderWithTheme(<WizardOverlay open={true} onClose={vi.fn()} />);
    expect(getByTestId('wizard-mock')).not.toBeNull();
  });

  it('does not render when closed', () => {
    const { queryByTestId } = renderWithTheme(<WizardOverlay open={false} onClose={vi.fn()} />);
    expect(queryByTestId('wizard-mock')).toBeNull();
  });

  it('has dialog role', () => {
    const { container } = renderWithTheme(<WizardOverlay open={true} onClose={vi.fn()} />);
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it('has aria-modal attribute', () => {
    const { container } = renderWithTheme(<WizardOverlay open={true} onClose={vi.fn()} />);
    expect(container.querySelector('[aria-modal="true"]')).not.toBeNull();
  });

  it('has close button', () => {
    const { container } = renderWithTheme(<WizardOverlay open={true} onClose={vi.fn()} />);
    expect(container.querySelector('[aria-label="Close wizard"]')).not.toBeNull();
  });
});
