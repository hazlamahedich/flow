import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { DraftEditor } from '../draft-editor';
import * as actions from '../../actions/draft-actions';

expect.extend(matchers);

vi.mock('../../actions/draft-actions', () => ({
  editDraft: vi.fn(),
  quickEditTone: vi.fn(),
  quickEditLength: vi.fn(),
}));

describe('DraftEditor', () => {
  const defaultProps = {
    draftId: 'draft-123',
    initialContent: 'Initial draft content',
    onSave: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(actions.editDraft).mockResolvedValue({ success: true } as never);
    vi.mocked(actions.quickEditTone).mockResolvedValue({
      success: true,
      data: { content: 'Professional rewrite' },
    } as never);
    vi.mocked(actions.quickEditLength).mockResolvedValue({
      success: true,
      data: { content: 'Shorter content' },
    } as never);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders initial content in textarea', () => {
    render(<DraftEditor {...defaultProps} />);
    expect(
      screen.getByDisplayValue('Initial draft content'),
    ).toBeInTheDocument();
  });

  it('updates content when typing', () => {
    render(<DraftEditor {...defaultProps} />);
    const textarea = screen.getByDisplayValue('Initial draft content');
    fireEvent.change(textarea, { target: { value: 'Updated content' } });
    expect(textarea).toHaveValue('Updated content');
  });

  it('calls editDraft when Save Changes is clicked', async () => {
    render(<DraftEditor {...defaultProps} />);

    const textarea = screen.getByDisplayValue('Initial draft content');
    fireEvent.change(textarea, { target: { value: 'Updated content' } });

    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    expect(actions.editDraft).toHaveBeenCalledWith({
      draftId: 'draft-123',
      content: 'Updated content',
    });

    await waitFor(() => {
      expect(defaultProps.onSave).toHaveBeenCalled();
    });
  });

  it('disables Save Changes when content equals initial', () => {
    render(<DraftEditor {...defaultProps} />);
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

  it('calls quickEditTone when Professional is clicked', async () => {
    render(<DraftEditor {...defaultProps} />);

    const profButton = screen.getByText('Professional');
    fireEvent.click(profButton);

    expect(actions.quickEditTone).toHaveBeenCalledWith({
      draftId: 'draft-123',
      tone: 'professional',
    });

    await waitFor(() => {
      expect(
        screen.getByDisplayValue('Professional rewrite'),
      ).toBeInTheDocument();
    });
  });
});
