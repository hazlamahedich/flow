import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FeedbackWidget } from '../feedback-widget';

vi.mock('../../../actions/feedback-actions', () => ({
  submitFeedback: vi.fn().mockResolvedValue({ success: true, data: { id: 'fb-1', sentiment: 'positive', note: null, createdAt: '2026-01-01' } }),
}));

function buildExistingFeedback(overrides: Partial<{ id: string; sentiment: 'positive' | 'negative'; note: string | null; createdAt: string }> = {}) {
  return {
    id: overrides.id ?? 'fb-1',
    sentiment: overrides.sentiment ?? 'positive',
    note: overrides.note ?? null,
    createdAt: overrides.createdAt ?? '2026-01-01T00:00:00Z',
  };
}

describe('FeedbackWidget', () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it('renders positive and negative buttons', () => {
    render(<FeedbackWidget runId="run-1" existingFeedback={null} />);
    expect(screen.getByRole('radio', { name: /positive/i })).toBeDefined();
    expect(screen.getByRole('radio', { name: /negative/i })).toBeDefined();
  });

  it('pre-selects existing sentiment', () => {
    render(<FeedbackWidget runId="run-1" existingFeedback={buildExistingFeedback({ sentiment: 'negative' })} />);
    expect(screen.getByRole('radio', { name: /negative/i }).getAttribute('aria-checked')).toBe('true');
  });

  it('shows textarea after selecting sentiment', async () => {
    render(<FeedbackWidget runId="run-1" existingFeedback={null} />);
    const positiveBtn = screen.getByRole('radio', { name: /positive/i });
    await userEvent.click(positiveBtn);
    expect(await screen.findByPlaceholderText(/note/i)).toBeDefined();
  });

  it('calls submitFeedback on save', async () => {
    render(<FeedbackWidget runId="run-1" existingFeedback={null} />);
    await userEvent.click(screen.getByRole('radio', { name: /positive/i }));
    await userEvent.click(screen.getByRole('button', { name: /save feedback/i }));
    const { submitFeedback } = await import('../../../actions/feedback-actions');
    expect(submitFeedback).toHaveBeenCalledWith({ runId: 'run-1', sentiment: 'positive', note: undefined });
  });

  it('disables save button while loading', async () => {
    const { submitFeedback } = await import('../../../actions/feedback-actions');
    vi.mocked(submitFeedback).mockReturnValue(new Promise(() => {}));
    render(<FeedbackWidget runId="run-1" existingFeedback={null} />);
    await userEvent.click(screen.getByRole('radio', { name: /positive/i }));
    await userEvent.click(screen.getByRole('button', { name: /save feedback/i }));
    expect(screen.getByRole('button', { name: /saving/i })).toHaveProperty('disabled', true);
  });

  it('has radiogroup role', () => {
    render(<FeedbackWidget runId="run-1" existingFeedback={null} />);
    expect(screen.getByRole('radiogroup', { name: /rate this action/i })).toBeDefined();
  });
});
