import { describe, it, expect } from 'vitest';
import { createTestJWT } from './jwt-helpers';

describe('createTestJWT', () => {
  it('throws without running Supabase instance', async () => {
    await expect(createTestJWT({ workspace_id: 'test' })).rejects.toThrow(
      'SUPABASE_JWT_SECRET is not set',
    );
  });
});
