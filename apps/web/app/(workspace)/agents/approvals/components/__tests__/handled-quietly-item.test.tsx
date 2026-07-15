import { render, screen, cleanup } from '@flow/test-utils';
import { HandledQuietlyItem } from '../handled-quietly-item';
import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../actions/handled-quietly-actions', () => ({
  promoteToInbox: vi
    .fn()
    .mockResolvedValue({ success: true, data: { emailId: 'e-1' } }),
}));

const baseEmail = {
  id: 'e-1',
  category: 'info',
  subject: 'Weekly Newsletter',
  sender: 'news@example.com',
  received_at: new Date().toISOString(),
  confidence: 0.85,
};

describe('HandledQuietlyItem', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders email subject and sender', () => {
    render(<HandledQuietlyItem email={baseEmail} />);
    expect(screen.getByText('Weekly Newsletter')).toBeDefined();
    expect(screen.getByText('news@example.com')).toBeDefined();
  });

  it('renders "(No Subject)" when subject is empty', () => {
    render(<HandledQuietlyItem email={{ ...baseEmail, subject: '' }} />);
    expect(screen.getByText('(No Subject)')).toBeDefined();
  });

  it('renders category badge text', () => {
    render(<HandledQuietlyItem email={baseEmail} />);
    expect(screen.getByText('info')).toBeDefined();
  });

  it('renders confidence percentage', () => {
    render(<HandledQuietlyItem email={baseEmail} />);
    expect(screen.getByText('85%')).toBeDefined();
  });

  it('defaults confidence to 0 when missing', () => {
    render(
      <HandledQuietlyItem email={{ ...baseEmail, confidence: undefined }} />,
    );
    expect(screen.getByText('0%')).toBeDefined();
  });

  it('renders promote button with accessible text', () => {
    render(<HandledQuietlyItem email={baseEmail} />);
    expect(
      screen.getByText('Actually, this needed my attention'),
    ).toBeDefined();
  });
});
