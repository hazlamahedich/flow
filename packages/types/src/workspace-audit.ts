export type WorkspaceAuditEvent =
  | { type: 'workspace_created'; workspaceId: string; slug: string; timestamp: string }
  | { type: 'member_invited'; workspaceId: string; email: string; role: string; invitedBy: string; timestamp: string }
  | { type: 'member_role_changed'; workspaceId: string; memberId: string; oldRole: string; newRole: string; changedBy: string; timestamp: string }
  | { type: 'member_revoked'; workspaceId: string; memberId: string; revokedBy: string; timestamp: string }
  | { type: 'member_expired'; workspaceId: string; memberId: string; timestamp: string }
  | { type: 'ownership_transferred'; workspaceId: string; fromUserId: string; toUserId: string; timestamp: string }
  | { type: 'client_access_granted'; workspaceId: string; userId: string; clientId: string; grantedBy: string; timestamp: string }
  | { type: 'client_access_revoked'; workspaceId: string; userId: string; clientId: string; revokedBy: string; timestamp: string }
  | { type: 'session_revoked_by_owner'; workspaceId: string; userId: string; revokedBy: string; timestamp: string }
  | { type: 'transfer_initiated'; workspaceId: string; fromUserId: string; toUserId: string; transferId: string; timestamp: string };

export type WorkspaceAuditEventType = WorkspaceAuditEvent['type'];
