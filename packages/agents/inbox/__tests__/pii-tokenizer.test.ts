import { describe, it, expect } from 'vitest';
import { tokenizePII, detokenizePII } from '../../shared/pii-tokenizer';

describe('pii-tokenizer', () => {
  describe('tokenizePII', () => {
    it('tokenizes email addresses', () => {
      const input = 'Please contact john.doe@example.com for details.';
      const result = tokenizePII(input, 'ws-1');

      expect(result.tokens).toHaveLength(1);
      expect(result.tokens[0]!.type).toBe('email');
      expect(result.tokens[0]!.original).toBe('john.doe@example.com');
      expect(result.text).not.toContain('john.doe@example.com');
      expect(result.text).toContain('[EMAIL_1]');
    });

    it('tokenizes financial amounts with currency symbols', () => {
      const input = 'Invoice total: $1,234.56 due by Friday.';
      const result = tokenizePII(input, 'ws-1');

      expect(result.tokens.some(t => t.type === 'financial')).toBe(true);
      expect(result.text).not.toContain('$1,234.56');
      expect(result.text).toContain('[FINANCIAL_1]');
    });

    it('tokenizes financial amounts with currency codes', () => {
      const input = 'Transfer 500.00 EUR to the account.';
      const result = tokenizePII(input, 'ws-1');

      expect(result.tokens.some(t => t.type === 'financial')).toBe(true);
      expect(result.text).not.toContain('500.00 EUR');
    });

    it('tokenizes phone numbers', () => {
      const input = 'Call me at +1-555-1234 or 555-567-8900.';
      const result = tokenizePII(input, 'ws-1');

      expect(result.tokens.some(t => t.type === 'phone')).toBe(true);
      expect(result.text).not.toContain('555-1234');
    });

    it('tokenizes multiple PII types in a single text', () => {
      const input = 'From: jane@test.com | Phone: +1-555-0000 | Amount: $99.99';
      const result = tokenizePII(input, 'ws-1');

      expect(result.tokens.length).toBeGreaterThanOrEqual(3);
      expect(result.text).not.toContain('jane@test.com');
      expect(result.text).not.toContain('$99.99');
      expect(result.text).not.toContain('555-0000');
    });

    it('handles text with no PII', () => {
      const input = 'This is a plain text with no personal information.';
      const result = tokenizePII(input, 'ws-1');

      expect(result.tokens).toHaveLength(0);
      expect(result.text).toBe(input);
    });

    it('replaces all occurrences of the same PII value', () => {
      const input = 'Email alice@work.com and cc alice@work.com again.';
      const result = tokenizePII(input, 'ws-1');

      const emailTokens = result.tokens.filter(t => t.type === 'email');
      expect(emailTokens).toHaveLength(1);
      const occurrences = result.text.match(new RegExp(emailTokens[0]!.token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'));
      expect(occurrences).toHaveLength(2);
    });
  });

  describe('detokenizePII', () => {
    it('restores original PII values from tokens', () => {
      const original = 'Contact john.doe@example.com for $500.00 USD.';
      const { text, tokens } = tokenizePII(original, 'ws-1');
      const restored = detokenizePII(text, tokens);

      expect(restored).toBe(original);
    });

    it('handles empty token list', () => {
      const result = detokenizePII('No tokens here', []);
      expect(result).toBe('No tokens here');
    });

    it('roundtrips complex text with all PII types', () => {
      const original = 'From: a@b.com | Call: +1-555-1234 | Pay: $1,000.00';
      const { text, tokens } = tokenizePII(original, 'ws-1');
      const restored = detokenizePII(text, tokens);

      expect(restored).toBe(original);
    });

    it('handles partial token replacement without corruption', () => {
      const tokens = [
        { original: 'long@example.com', token: '[EMAIL_1]', type: 'email' as const },
        { original: 'short@x.io', token: '[EMAIL_2]', type: 'email' as const },
      ];

      const text = 'Send to [EMAIL_1] and [EMAIL_2]';
      const restored = detokenizePII(text, tokens);

      expect(restored).toBe('Send to long@example.com and short@x.io');
    });
  });
});
