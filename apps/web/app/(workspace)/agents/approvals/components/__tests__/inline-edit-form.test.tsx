import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { InlineEditForm } from '../inline-edit-form';

const defaultProps = {
  proposal: { title: 'Test Proposal', confidence: 0.85, riskLevel: 'low' as const, reasoning: 'Test reasoning' },
  reasoning: 'Test reasoning',
  onSave: vi.fn().mockResolvedValue({ success: true }),
  onCancel: vi.fn(),
  onEscape: vi.fn(),
};

describe('InlineEditForm', () => {
  beforeEach(() => { cleanup(); vi.clearAllMocks(); });

  it('renders edit fields', () => {
    render(<InlineEditForm {...defaultProps} />);
    expect(screen.getByDisplayValue('Test Proposal')).toBeDefined();
    expect(screen.getByDisplayValue('0.85')).toBeDefined();
  });

  it('shows reasoning above edit area', () => {
    render(<InlineEditForm {...defaultProps} />);
    expect(screen.getByText('Agent Reasoning')).toBeDefined();
  });

  it('has Save and Cancel buttons', () => {
    render(<InlineEditForm {...defaultProps} />);
    expect(screen.getByRole('button', { name: /Save/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeDefined();
  });
});
