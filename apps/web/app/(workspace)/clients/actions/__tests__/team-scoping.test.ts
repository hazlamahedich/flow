import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase-server', () => ({
  getServerSupabase: vi.fn(),
}));

vi.mock('@flow/db', () => ({
  requireTenantContext: vi.fn(),
  createFlowError: (status: number, code: string, message: string, category: string) => ({ status, code, message, category }),
  cacheTag: vi.fn((entity: string, id: string) => `${entity}:${id}`),
  assignMemberToClient: vi.fn(),
  revokeMemberAccess: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}));

import { assignTeamMember } from '../../[clientId]/actions/assign-team-member';
import { revokeTeamMember } from '../../[clientId]/actions/revoke-team-member';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext, assignMemberToClient, revokeMemberAccess } from '@flow/db';

const mockGetServerSupabase = vi.mocked(getServerSupabase);
const mockRequireTenantContext = vi.mocked(requireTenantContext);
const mockAssign = vi.mocked(assignMemberToClient);
const mockRevoke = vi.mocked(revokeMemberAccess);

const mockSupabase = {};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetServerSupabase.mockResolvedValue(mockSupabase as never);
  mockRequireTenantContext.mockResolvedValue({ workspaceId: 'ws1', userId: 'u1', role: 'owner' });
  mockAssign.mockResolvedValue(undefined);
  mockRevoke.mockResolvedValue(1);
});

describe('assignTeamMember', () => {
  it('allows owner to assign', async () => {
    const result = await assignTeamMember({ userId: '550e8400-e29b-41d4-a716-446655440000', clientId: '550e8400-e29b-41d4-a716-446655440001' });
    expect(result.success).toBe(true);
    expect(mockAssign).toHaveBeenCalled();
  });

  it('rejects member', async () => {
    mockRequireTenantContext.mockResolvedValue({ workspaceId: 'ws1', userId: 'u1', role: 'member' });
    const result = await assignTeamMember({ userId: '550e8400-e29b-41d4-a716-446655440000', clientId: '550e8400-e29b-41d4-a716-446655440001' });
    expect(result.success).toBe(false);
  });
});

describe('revokeTeamMember', () => {
  it('allows owner to revoke', async () => {
    const result = await revokeTeamMember({ userId: '550e8400-e29b-41d4-a716-446655440000', clientId: '550e8400-e29b-41d4-a716-446655440001' });
    expect(result.success).toBe(true);
    expect(mockRevoke).toHaveBeenCalled();
  });

  it('rejects member', async () => {
    mockRequireTenantContext.mockResolvedValue({ workspaceId: 'ws1', userId: 'u1', role: 'member' });
    const result = await revokeTeamMember({ userId: '550e8400-e29b-41d4-a716-446655440000', clientId: '550e8400-e29b-41d4-a716-446655440001' });
    expect(result.success).toBe(false);
  });
});
