import { describe, it, expect } from 'vitest';

describe('@flow/shared', () => {
  it('exports from workspace package', async () => {
    const mod = await import('@flow/shared');
    expect(mod).toBeDefined();
  });
});
