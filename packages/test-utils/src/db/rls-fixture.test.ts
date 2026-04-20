import { describe, it, expect } from 'vitest';
import { setupRLSFixture } from './rls-fixture';

describe('setupRLSFixture', () => {
  it('throws without running Supabase instance', async () => {
    await expect(setupRLSFixture('ws-id', 'owner')).rejects.toThrow(
      'NEXT_PUBLIC_SUPABASE_URL is not set',
    );
  });
});
