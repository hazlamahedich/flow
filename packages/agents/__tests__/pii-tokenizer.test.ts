import { describe, it, expect } from 'vitest';
import { tokenizePII, detokenizePII } from '../shared/pii-tokenizer';

describe('tokenizePII', () => {
  it('returns empty array for stub implementation', () => {
    const result = tokenizePII('Hello john@example.com', 'ws-1');
    expect(Array.isArray(result)).toBe(true);
  });
});

describe('detokenizePII', () => {
  it('returns original text for stub implementation', () => {
    const result = detokenizePII('Hello [TOKEN]', []);
    expect(result).toBe('Hello [TOKEN]');
  });

  it('returns text unchanged when no tokens provided', () => {
    const text = 'No PII here';
    expect(detokenizePII(text, [])).toBe(text);
  });
});
