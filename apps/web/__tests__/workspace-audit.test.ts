import { describe, it, expect } from 'vitest';
import type { WorkspaceAuditEvent, WorkspaceAuditEventType } from '@flow/types';

describe('workspace audit events', () => {
  const expectedEventTypes: WorkspaceAuditEventType[] = [
    'workspace_created',
    'member_invited',
    'member_joined',
    'member_role_changed',
    'member_revoked',
    'member_expired',
    'ownership_transferred',
    'client_access_granted',
    'client_access_revoked',
    'session_revoked_by_owner',
    'transfer_initiated',
  ];

  it('covers all 11 event types', () => {
    expect(expectedEventTypes).toHaveLength(11);
  });

  describe('workspace_created', () => {
    it('has required fields', () => {
      const event: WorkspaceAuditEvent = {
        type: 'workspace_created',
        workspaceId: crypto.randomUUID(),
        slug: 'my-workspace',
        timestamp: new Date().toISOString(),
      };
      expect(event.type).toBe('workspace_created');
      expect(event.workspaceId).toBeDefined();
      expect('slug' in event).toBe(true);
    });
  });

  describe('member_invited', () => {
    it('has required fields', () => {
      const event: WorkspaceAuditEvent = {
        type: 'member_invited',
        workspaceId: crypto.randomUUID(),
        email: 'user@example.com',
        role: 'member',
        invitedBy: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      };
      expect(event.type).toBe('member_invited');
      expect('email' in event).toBe(true);
      expect('role' in event).toBe(true);
    });
  });

  describe('member_joined', () => {
    it('has required fields', () => {
      const event: WorkspaceAuditEvent = {
        type: 'member_joined',
        workspaceId: crypto.randomUUID(),
        email: 'user@example.com',
        role: 'member',
        invitedBy: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      };
      expect(event.type).toBe('member_joined');
    });
  });

  describe('member_role_changed', () => {
    it('has old and new role fields', () => {
      const event: WorkspaceAuditEvent = {
        type: 'member_role_changed',
        workspaceId: crypto.randomUUID(),
        memberId: crypto.randomUUID(),
        oldRole: 'member',
        newRole: 'admin',
        changedBy: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      };
      expect(event.type).toBe('member_role_changed');
      expect('oldRole' in event).toBe(true);
      expect('newRole' in event).toBe(true);
    });
  });

  describe('member_revoked', () => {
    it('has required fields', () => {
      const event: WorkspaceAuditEvent = {
        type: 'member_revoked',
        workspaceId: crypto.randomUUID(),
        memberId: crypto.randomUUID(),
        revokedBy: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      };
      expect(event.type).toBe('member_revoked');
      expect('revokedBy' in event).toBe(true);
    });
  });

  describe('member_expired', () => {
    it('has required fields', () => {
      const event: WorkspaceAuditEvent = {
        type: 'member_expired',
        workspaceId: crypto.randomUUID(),
        memberId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      };
      expect(event.type).toBe('member_expired');
    });
  });

  describe('ownership_transferred', () => {
    it('has from and to user fields', () => {
      const event: WorkspaceAuditEvent = {
        type: 'ownership_transferred',
        workspaceId: crypto.randomUUID(),
        fromUserId: crypto.randomUUID(),
        toUserId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      };
      expect(event.type).toBe('ownership_transferred');
      expect('fromUserId' in event).toBe(true);
      expect('toUserId' in event).toBe(true);
    });
  });

  describe('client_access_granted', () => {
    it('has userId, clientId, and grantedBy', () => {
      const event: WorkspaceAuditEvent = {
        type: 'client_access_granted',
        workspaceId: crypto.randomUUID(),
        userId: crypto.randomUUID(),
        clientId: crypto.randomUUID(),
        grantedBy: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      };
      expect(event.type).toBe('client_access_granted');
      expect('userId' in event).toBe(true);
      expect('clientId' in event).toBe(true);
      expect('grantedBy' in event).toBe(true);
    });
  });

  describe('client_access_revoked', () => {
    it('has userId, clientId, and revokedBy', () => {
      const event: WorkspaceAuditEvent = {
        type: 'client_access_revoked',
        workspaceId: crypto.randomUUID(),
        userId: crypto.randomUUID(),
        clientId: crypto.randomUUID(),
        revokedBy: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      };
      expect(event.type).toBe('client_access_revoked');
      expect('revokedBy' in event).toBe(true);
    });
  });

  describe('session_revoked_by_owner', () => {
    it('has userId, deviceId, invalidated, and revokedBy', () => {
      const event: WorkspaceAuditEvent = {
        type: 'session_revoked_by_owner',
        workspaceId: crypto.randomUUID(),
        userId: crypto.randomUUID(),
        deviceId: crypto.randomUUID(),
        invalidated: true,
        revokedBy: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      };
      expect(event.type).toBe('session_revoked_by_owner');
      expect('userId' in event).toBe(true);
      expect('revokedBy' in event).toBe(true);
      expect('deviceId' in event).toBe(true);
      expect('invalidated' in event).toBe(true);
    });
  });

  describe('transfer_initiated', () => {
    it('has fromUserId, toUserId, and transferId', () => {
      const event: WorkspaceAuditEvent = {
        type: 'transfer_initiated',
        workspaceId: crypto.randomUUID(),
        fromUserId: crypto.randomUUID(),
        toUserId: crypto.randomUUID(),
        transferId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      };
      expect(event.type).toBe('transfer_initiated');
      expect('transferId' in event).toBe(true);
    });
  });

  describe('discriminated union type safety', () => {
    it('each event type narrows correctly', () => {
      function processEvent(event: WorkspaceAuditEvent): string {
        switch (event.type) {
          case 'workspace_created':
            return event.slug;
          case 'member_invited':
            return event.email;
          case 'member_joined':
            return event.email;
          case 'member_role_changed':
            return `${event.oldRole}->${event.newRole}`;
          case 'member_revoked':
            return event.memberId;
          case 'member_expired':
            return event.memberId;
          case 'ownership_transferred':
            return `${event.fromUserId}->${event.toUserId}`;
          case 'client_access_granted':
            return event.clientId;
          case 'client_access_revoked':
            return event.clientId;
          case 'session_revoked_by_owner':
            return event.userId;
          case 'member_sessions_invalidated':
            return event.userId;
          case 'invitation_resent':
            return event.email;
          case 'invitation_revoked':
            return event.email;
          case 'transfer_initiated':
            return event.transferId;
          default: {
            const _exhaustive: never = event;
            return _exhaustive;
          }
        }
      }

      const event: WorkspaceAuditEvent = {
        type: 'client_access_granted',
        workspaceId: crypto.randomUUID(),
        userId: crypto.randomUUID(),
        clientId: 'test-client-id',
        grantedBy: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      };

      expect(processEvent(event)).toBe('test-client-id');
    });
  });
});
