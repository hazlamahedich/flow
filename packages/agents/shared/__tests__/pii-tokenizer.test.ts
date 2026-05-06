import { describe, it, expect } from 'vitest';
import { tokenizePII, detokenizePII } from '../pii-tokenizer';

describe('pii-tokenizer', () => {
  it('tokenizes emails, phone numbers and currency', () => {
    const text = 'Contact me at john.doe@example.com or call +1-555-0199. The cost is $150.00.';
    const { text: tokenized, tokens } = tokenizePII(text, 'ws-1');

    expect(tokenized).not.toContain('john.doe@example.com');
    expect(tokenized).not.toContain('+1-555-0199');
    expect(tokenized).not.toContain('$150.00');
    expect(tokenized).toContain('[EMAIL_');
    expect(tokenized).toContain('[PHONE_');
    expect(tokenized).toContain('[FINANCIAL_');
    
    expect(tokens.length).toBe(3);
  });

  it('detokenizes back to original text', () => {
    const text = 'Meeting with alice@test.com at 5pm.';
    const { text: tokenized, tokens } = tokenizePII(text, 'ws-1');
    const detokenized = detokenizePII(tokenized, tokens);

    expect(detokenized).toBe(text);
  });

  it('handles multiple occurrences of the same PII', () => {
    const text = 'Send to test@test.com and CC test@test.com';
    const { text: tokenized, tokens } = tokenizePII(text, 'ws-1');

    expect(tokenized.match(/\[EMAIL_1\]/g)?.length).toBe(2);
    expect(tokens.length).toBe(1);
  });
});
