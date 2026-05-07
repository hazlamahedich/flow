import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { DraftEditor } from '../draft-editor';
import { useOptimisticAction } from '../use-optimistic-action';
import * as actions from '../../actions/draft-actions';

expect.extend(matchers);

// Mock the hook
vi.mock('../use-optimistic-action', () => ({
  useOptimisticAction: vi.fn()
}));

// Mock the actions
vi.mock('../../actions/draft-actions', () => ({
  editDraft: vi.fn(),
  quickEditTone: vi.fn(),
  quickEditLength: vi.fn()
}));

describe('DraftEditor', () => {
  const mockExecute = vi.fn();
  const defaultProps = {
    draftId: 'draft-123',
    initialContent: 'Initial draft content',
    onSave: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useOptimisticAction as any).mockReturnValue({
      isPending: false,
      execute: mockExecute
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders initial content in textarea', () => {
    render(<DraftEditor {...defaultProps} />);
    expect(screen.getByDisplayValue('Initial draft content')).toBeInTheDocument();
  });

  it('updates content when typing', () => {
    render(<DraftEditor {...defaultProps} />);
    const textarea = screen.getByDisplayValue('Initial draft content');
    fireEvent.change(textarea, { target: { value: 'Updated content' } });
    expect(textarea).toHaveValue('Updated content');
  });

  it('calls editAction.execute when Save Changes is clicked', async () => {
    mockExecute.mockResolvedValue({ success: true });
    render(<DraftEditor {...defaultProps} />);
    
    const textarea = screen.getByDisplayValue('Initial draft content');
    fireEvent.change(textarea, { target: { value: 'Updated content' } });
    
    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    expect(mockExecute).toHaveBeenCalledWith({
      draftId: 'draft-123',
      content: 'Updated content'
    });
    
    await waitFor(() => {
      expect(defaultProps.onSave).toHaveBeenCalled();
    });
  });

  it('disables buttons when an action is pending', () => {
    (useOptimisticAction as any).mockReturnValue({
      isPending: true,
      execute: mockExecute
    });

    render(<DraftEditor {...defaultProps} />);
    
    expect(screen.getByDisplayValue('Initial draft content')).toBeDisabled();
    expect(screen.getByText('Professional')).toBeDisabled();
    expect(screen.getByText('Friendly')).toBeDisabled();
    expect(screen.getByText('Shorter')).toBeDisabled();
    expect(screen.getByText('Longer')).toBeDisabled();
    expect(screen.getByText('Save Changes')).toBeDisabled();
  });

  it('resets content when Reset button is clicked', () => {
    render(<DraftEditor {...defaultProps} />);
    const textarea = screen.getByDisplayValue('Initial draft content');
    fireEvent.change(textarea, { target: { value: 'Modified content' } });
    expect(textarea).toHaveValue('Modified content');

    const resetButton = screen.getByText('Reset');
    fireEvent.click(resetButton);
    expect(textarea).toHaveValue('Initial draft content');
  });

  it('calls toneAction.execute when Professional is clicked', async () => {
    const mockToneExecute = vi.fn().mockResolvedValue({ 
      success: true, 
      data: { content: 'Professional rewrite' } 
    });
    
    (useOptimisticAction as any).mockImplementation((action: any) => {
      if (action === actions.quickEditTone) {
        return { isPending: false, execute: mockToneExecute };
      }
      return { isPending: false, execute: mockExecute };
    });

    render(<DraftEditor {...defaultProps} />);
    
    const profButton = screen.getByText('Professional');
    fireEvent.click(profButton);

    expect(mockToneExecute).toHaveBeenCalledWith({
      draftId: 'draft-123',
      tone: 'professional'
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue('Professional rewrite')).toBeInTheDocument();
    });
  });
});
