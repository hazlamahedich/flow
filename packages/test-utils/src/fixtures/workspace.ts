import { createHash, randomBytes } from 'crypto';

interface WorkspaceOverrides {
  id?: string;
  name?: string;
  slug?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  settings?: Record<string, unknown>;
}

export function buildWorkspace(overrides: WorkspaceOverrides = {}) {
  const id = overrides.id ?? crypto.randomUUID();
  const name = overrides.name ?? `Test Workspace ${id.slice(0, 8)}`;
  const slug = overrides.slug ?? name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
  return {
    id,
    name,
    slug,
    createdBy: overrides.createdBy ?? null,
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    updatedAt: overrides.updatedAt ?? new Date().toISOString(),
    settings: overrides.settings ?? {},
  };
}

interface MemberOverrides {
  id?: string;
  workspaceId?: string;
  userId?: string;
  role?: string;
  status?: 'active' | 'expired' | 'revoked';
  joinedAt?: string;
  expiresAt?: string | null;
  removedAt?: string | null;
  updatedAt?: string;
}

export function buildMember(overrides: MemberOverrides = {}) {
  const workspaceId = overrides.workspaceId ?? crypto.randomUUID();
  const userId = overrides.userId ?? crypto.randomUUID();
  return {
    id: overrides.id ?? crypto.randomUUID(),
    workspaceId,
    userId,
    role: overrides.role ?? 'member',
    status: overrides.status ?? 'active',
    joinedAt: overrides.joinedAt ?? new Date().toISOString(),
    expiresAt: overrides.expiresAt ?? null,
    removedAt: overrides.removedAt ?? null,
    updatedAt: overrides.updatedAt ?? new Date().toISOString(),
  };
}

interface InvitationOverrides {
  id?: string;
  workspaceId?: string;
  email?: string;
  role?: string;
  tokenHash?: string;
  expiresAt?: string;
  acceptedAt?: string | null;
  invitedBy?: string;
  createdAt?: string;
}

export function buildInvitation(overrides: InvitationOverrides = {}) {
  const rawToken = crypto.randomUUID();
  const tokenHash = overrides.tokenHash ?? createHash('sha256').update(rawToken).digest('hex');
  return {
    id: overrides.id ?? crypto.randomUUID(),
    workspaceId: overrides.workspaceId ?? crypto.randomUUID(),
    email: overrides.email ?? `invite-${randomBytes(4).toString('hex')}@test.flow.local`,
    role: overrides.role ?? 'member',
    tokenHash,
    expiresAt: overrides.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    acceptedAt: overrides.acceptedAt ?? null,
    invitedBy: overrides.invitedBy ?? crypto.randomUUID(),
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    _rawToken: rawToken,
  };
}

interface TransferRequestOverrides {
  id?: string;
  workspaceId?: string;
  fromUserId?: string;
  toUserId?: string;
  status?: string;
  createdAt?: string;
  expiresAt?: string;
  acceptedAt?: string | null;
}

export function buildTransferRequest(overrides: TransferRequestOverrides = {}) {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    workspaceId: overrides.workspaceId ?? crypto.randomUUID(),
    fromUserId: overrides.fromUserId ?? crypto.randomUUID(),
    toUserId: overrides.toUserId ?? crypto.randomUUID(),
    status: overrides.status ?? 'pending',
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    expiresAt: overrides.expiresAt ?? new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    acceptedAt: overrides.acceptedAt ?? null,
  };
}
