import { describe, it, expect } from 'vitest';
import { tokenizePII, detokenizePII } from '../shared/pii-tokenizer';

describe('tokenizePII', () => {
  it('returns result object with text and tokens', () => {
    const result = tokenizePII('Hello john@example.com', 'ws-1');
    expect(result).toHaveProperty('text');
    expect(result).toHaveProperty('tokens');
    expect(Array.isArray(result.tokens)).toBe(true);
  });
});

describe('detokenizePII', () => {
  it('returns original text when tokens match', () => {
    const original = 'Hello john@example.com';
    const { text, tokens } = tokenizePII(original, 'ws-1');
    const result = detokenizePII(text, tokens);
    expect(result).toBe(original);
  });

  it('returns text unchanged when no tokens provided', () => {
    const text = 'No PII here';
    expect(detokenizePII(text, [])).toBe(text);
  });
});
