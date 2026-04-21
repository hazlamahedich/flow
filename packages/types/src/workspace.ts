import { z } from 'zod';

export const RoleEnum = z.enum(['owner', 'admin', 'member', 'client_user']);
export type Role = z.infer<typeof RoleEnum>;

export const MemberStatusEnum = z.enum(['active', 'expired', 'revoked']);
export type MemberStatus = z.infer<typeof MemberStatusEnum>;

export const TransferStatusEnum = z.enum(['pending', 'accepted', 'expired', 'cancelled']);
export type TransferStatus = z.infer<typeof TransferStatusEnum>;

export const InvitationRoleEnum = z.enum(['admin', 'member']);
export type InvitationRole = z.infer<typeof InvitationRoleEnum>;

export const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
});
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

export const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: InvitationRoleEnum,
  workspaceId: z.string().uuid(),
});
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const updateRoleSchema = z.object({
  memberId: z.string().uuid(),
  role: RoleEnum,
  workspaceId: z.string().uuid(),
});
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;

export const revokeMemberSchema = z.object({
  memberId: z.string().uuid(),
  workspaceId: z.string().uuid(),
});
export type RevokeMemberInput = z.infer<typeof revokeMemberSchema>;

export const initiateTransferSchema = z.object({
  toUserId: z.string().uuid(),
  workspaceId: z.string().uuid(),
});
export type InitiateTransferInput = z.infer<typeof initiateTransferSchema>;

export const confirmTransferSchema = z.object({
  transferId: z.string().uuid(),
  workspaceId: z.string().uuid(),
});
export type ConfirmTransferInput = z.infer<typeof confirmTransferSchema>;

export const scopeClientAccessSchema = z.object({
  userId: z.string().uuid(),
  clientId: z.string().uuid(),
  workspaceId: z.string().uuid(),
});
export type ScopeClientAccessInput = z.infer<typeof scopeClientAccessSchema>;

export const workspaceSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  slug: z.string(),
  createdBy: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  settings: z.record(z.unknown()),
});
export type Workspace = z.infer<typeof workspaceSchema>;

export const workspaceMemberSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  userId: z.string().uuid(),
  role: RoleEnum,
  status: MemberStatusEnum,
  joinedAt: z.string().datetime(),
  expiresAt: z.string().datetime().nullable(),
  removedAt: z.string().datetime().nullable(),
  updatedAt: z.string().datetime(),
});
export type WorkspaceMember = z.infer<typeof workspaceMemberSchema>;

export const workspaceInvitationSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  email: z.string().email(),
  role: InvitationRoleEnum,
  tokenHash: z.string(),
  expiresAt: z.string().datetime(),
  acceptedAt: z.string().datetime().nullable(),
  invitedBy: z.string().uuid(),
  createdAt: z.string().datetime().nullable(),
});
export type WorkspaceInvitation = z.infer<typeof workspaceInvitationSchema>;

export const transferRequestSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  fromUserId: z.string().uuid(),
  toUserId: z.string().uuid(),
  status: TransferStatusEnum,
  createdAt: z.string().datetime().nullable(),
  expiresAt: z.string().datetime(),
  acceptedAt: z.string().datetime().nullable(),
});
export type TransferRequest = z.infer<typeof transferRequestSchema>;
