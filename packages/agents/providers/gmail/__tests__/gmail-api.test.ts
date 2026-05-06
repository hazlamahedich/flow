import { describe, it, expect, vi } from 'vitest';

vi.mock('googleapis', () => ({
  google: {
    gmail: vi.fn(() => ({
      users: {
        history: {
          list: vi.fn().mockResolvedValue({ data: { history: [] } }),
        },
        messages: {
          list: vi.fn().mockResolvedValue({ data: { messages: [] } }),
          get: vi.fn().mockResolvedValue({
            data: {
              id: 'msg1',
              threadId: 'thread1',
              payload: {
                headers: [
                  { name: 'Subject', value: 'Test Subject' },
                  { name: 'From', value: 'Sender <sender@test.com>' },
                  { name: 'To', value: 'recipient@test.com' },
                  { name: 'Date', value: 'Mon, 1 Jan 2024 00:00:00 +0000' },
                ],
                mimeType: 'multipart/alternative',
                parts: [
                  {
                    mimeType: 'text/plain',
                    body: { data: Buffer.from('plain text').toString('base64') },
                  },
                  {
                    mimeType: 'text/html',
                    body: { data: Buffer.from('<p>html text</p>').toString('base64') },
                  },
                ],
              },
            },
          }),
        },
        getProfile: vi.fn().mockResolvedValue({
          data: { emailAddress: 'test@gmail.com', historyId: '1000' },
        }),
        watch: vi.fn().mockResolvedValue({
          data: { historyId: '1000', expiration: '1234567890000' },
        }),
        stop: vi.fn().mockResolvedValue({}),
      },
    })),
  },
}));

import { getProfile, watchInbox, stopWatch, getMessageMetadata, getMessage, listMessages, getHistorySince } from '../gmail-api';

describe('gmail-api', () => {
  describe('getProfile', () => {
    it('returns email and history ID', async () => {
      const result = await getProfile('fake-token');
      expect(result.emailAddress).toBe('test@gmail.com');
      expect(result.historyId).toBe('1000');
    });
  });

  describe('watchInbox', () => {
    it('returns history ID and expiration', async () => {
      const result = await watchInbox('fake-token', 'projects/test/topics/gmail-push');
      expect(result.historyId).toBe('1000');
      expect(result.expiration).toBe('1234567890000');
    });
  });

  describe('stopWatch', () => {
    it('completes without error', async () => {
      await expect(stopWatch('fake-token')).resolves.toBeUndefined();
    });
  });

  describe('getMessageMetadata', () => {
    it('parses message headers correctly', async () => {
      const result = await getMessageMetadata('fake-token', 'msg1');
      expect(result.gmailMessageId).toBe('msg1');
      expect(result.subject).toBe('Test Subject');
      expect(result.fromAddress).toBe('sender@test.com');
      expect(result.fromName).toBe('Sender');
    });
  });

  describe('getMessage', () => {
    it('parses full message including body content', async () => {
      const result = await getMessage('fake-token', 'msg1');
      expect(result.gmailMessageId).toBe('msg1');
      expect(result.subject).toBe('Test Subject');
      expect(result.bodyText).toBe('plain text');
      expect(result.bodyHtml).toBe('<p>html text</p>');
    });
  });

  describe('listMessages', () => {
    it('returns empty array when no messages', async () => {
      const result = await listMessages('fake-token', 'after:1234567890', 100);
      expect(result).toEqual([]);
    });
  });

  describe('getHistorySince', () => {
    it('returns empty array when no history', async () => {
      const result = await getHistorySince('fake-token', '1');
      expect(result).toEqual([]);
    });
  });
});
