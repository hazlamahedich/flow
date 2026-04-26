import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ErrorDisplay } from '../error-display';

describe('ErrorDisplay', () => {
  afterEach(() => cleanup());

  it('renders unknown error when error is null', () => {
    render(<ErrorDisplay error={null} />);
    expect(screen.getByText('unknown')).toBeDefined();
  });

  it('renders error code from error object', () => {
    render(<ErrorDisplay error={{ code: 'RATE_LIMIT', retryable: false }} />);
    expect(screen.getByText('RATE_LIMIT')).toBeDefined();
  });

  it('renders entity when present', () => {
    render(<ErrorDisplay error={{ code: 'NOT_FOUND', entity: 'workspace', retryable: false }} />);
    expect(screen.getByText(/Affected: workspace/)).toBeDefined();
  });

  it('renders resolution when present', () => {
    render(<ErrorDisplay error={{ code: 'TIMEOUT', resolution: 'Retry in 30s', retryable: false }} />);
    expect(screen.getByText('Retry in 30s')).toBeDefined();
  });

  it('renders retry button when retryable', () => {
    render(<ErrorDisplay error={{ code: 'TIMEOUT', retryable: true }} />);
    expect(screen.getByRole('button')).toBeDefined();
  });

  it('does not render retry button when not retryable', () => {
    render(<ErrorDisplay error={{ code: 'NOT_FOUND', retryable: false }} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('does not render entity line when entity is missing', () => {
    render(<ErrorDisplay error={{ code: 'UNKNOWN', retryable: false }} />);
    expect(screen.queryByText(/Affected:/)).toBeNull();
  });
});
