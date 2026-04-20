import { describe, it, expect } from 'vitest';
import { createTestTenant } from './tenant-factory';

describe('createTestTenant', () => {
  it('throws without running Supabase instance', async () => {
    await expect(
      createTestTenant({ roles: ['owner'] }),
    ).rejects.toThrow('NEXT_PUBLIC_SUPABASE_URL is not set');
  });
});
