'use client';

import { useState, useEffect, useCallback } from 'react';
import { ConfirmRevokeDialog } from './confirm-revoke-dialog';
import { ConfirmTransferDialog } from './confirm-transfer-dialog';
import { ClientScopingDialog } from './client-scoping-dialog';
import { TeamMemberCards } from './team-member-cards';

interface TeamMember {
  id: string;
  userId: string;
  role: string;
  status: string;
  joinedAt: string;
  expiresAt: string | null;
  name: string;
  email: string;
}

interface TeamMemberListProps {
  members: TeamMember[];
  actorRole: string;
  canManageRoles: boolean;
  canRevoke: boolean;
  canScopeClients: boolean;
  canTransfer: boolean;
  workspaceId: string;
  workspaceName: string;
}

export function TeamMemberList({
  members,
  actorRole,
  canManageRoles,
  canRevoke,
  canScopeClients,
  canTransfer,
  workspaceId,
  workspaceName,
}: TeamMemberListProps) {
  const [revokingMember, setRevokingMember] = useState<TeamMember | null>(null);
  const [transferMember, setTransferMember] = useState<TeamMember | null>(null);
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);
  const [scopingMember, setScopingMember] = useState<TeamMember | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setRevokingMember(null);
      setTransferMember(null);
      setScopingMember(null);
      setError(null);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [handleEscape]);

  async function handleRoleChange(memberId: string, newRole: string, currentRole: string) {
    if (newRole === currentRole) return;
    setUpdatingRole(memberId);
    setError(null);
    try {
      const { updateRole } = await import('../actions/update-role');
      const result = await updateRole({ memberId, role: newRole });
      if (!result.success) {
        setError(result.error.message);
      }
    } catch {
      setError("Couldn't update role. No changes were made.");
    } finally {
      setUpdatingRole(null);
    }
  }

  async function handleRevoke() {
    if (!revokingMember) return;
    setError(null);
    try {
      const { revokeMember } = await import('../actions/revoke-member');
      const result = await revokeMember({ memberId: revokingMember.id });
      if (!result.success) {
        setError(result.error.message);
      }
    } catch {
      setError("Couldn't remove member. Please try again.");
    } finally {
      setRevokingMember(null);
    }
  }

  async function handleTransfer() {
    if (!transferMember) return;
    setError(null);
    try {
      const { initiateTransfer } = await import('../actions/initiate-transfer');
      const result = await initiateTransfer({ toUserId: transferMember.userId });
      if (!result.success) {
        setError(result.error.message);
      }
    } catch {
      setError("Couldn't complete the action. Please try again.");
    } finally {
      setTransferMember(null);
    }
  }

  function getAvailableRoles(currentRole: string): string[] {
    if (actorRole === 'owner') {
      return currentRole === 'owner' ? ['owner'] : ['admin', 'member'];
    }
    return [];
  }

  return (
    <>
      {error && (
        <div role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="hidden md:block">
        <table className="w-full text-sm" aria-label="Team members table">
          <thead>
            <tr className="border-b border-[var(--flow-color-border-default)]">
              <th className="pb-2 text-left font-medium text-[var(--flow-color-text-secondary)]">Name</th>
              <th className="pb-2 text-left font-medium text-[var(--flow-color-text-secondary)]">Role</th>
              <th className="pb-2 text-right font-medium text-[var(--flow-color-text-secondary)]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id} className="border-b border-[var(--flow-color-border-default)]">
                <td className="py-3">
                  <div className="font-medium text-[var(--flow-color-text-primary)]">{member.name}</div>
                  <div className="text-xs text-[var(--flow-color-text-secondary)]">{member.email}</div>
                </td>
                <td className="py-3">
                  {canManageRoles && member.role !== 'owner' ? (
                    <select
                      value={member.role}
                      onChange={(e) => handleRoleChange(member.id, e.target.value, member.role)}
                      disabled={updatingRole === member.id}
                      aria-label={`Change role for ${member.name}`}
                      className="rounded-md border border-[var(--flow-color-border-default)] px-2 py-1 text-sm"
                    >
                      {getAvailableRoles(member.role).map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="capitalize text-[var(--flow-color-text-secondary)]" aria-label={`Role: ${member.role}`}>
                      {member.role}
                    </span>
                  )}
                </td>
                <td className="py-3 text-right space-x-2">
                  {canScopeClients && member.role === 'member' && (
                    <button
                      type="button"
                      onClick={() => setScopingMember(member)}
                      className="text-xs text-[var(--flow-color-text-secondary)] hover:text-[var(--flow-color-text-primary)] underline"
                      aria-label={`Manage client access for ${member.name}`}
                    >
                      Client Scoping
                    </button>
                  )}
                  {canRevoke && member.role !== 'owner' && (
                    <button
                      type="button"
                      onClick={() => setRevokingMember(member)}
                      aria-label={`Remove ${member.name} from workspace`}
                      className="rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      Remove
                    </button>
                  )}
                  {canTransfer && member.role !== 'owner' && (
                    <button
                      type="button"
                      onClick={() => setTransferMember(member)}
                      aria-label={`Transfer ownership to ${member.name}`}
                      className="rounded-md border border-[var(--flow-color-border-default)] px-3 py-1 text-xs font-medium text-[var(--flow-color-text-primary)] hover:bg-[var(--flow-color-bg-secondary)]"
                    >
                      Transfer
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <TeamMemberCards
        members={members}
        canManageRoles={canManageRoles}
        canRevoke={canRevoke}
        canTransfer={canTransfer}
        updatingRole={updatingRole}
        onRoleChange={handleRoleChange}
        onRevoke={setRevokingMember}
        onTransfer={setTransferMember}
      />

      {revokingMember && (
        <ConfirmRevokeDialog
          memberName={revokingMember.name}
          isActive={revokingMember.status === 'active'}
          onConfirm={handleRevoke}
          onCancel={() => setRevokingMember(null)}
          open={!!revokingMember}
          onOpenChange={(open) => { if (!open) setRevokingMember(null); }}
        />
      )}

      {transferMember && (
        <div
          className="fixed inset-0 z-50 bg-black/50"
          onClick={() => setTransferMember(null)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <ConfirmTransferDialog
              workspaceName={workspaceName}
              targetName={transferMember.name}
              targetIsActive={transferMember.status === 'active'}
              onConfirm={handleTransfer}
              onCancel={() => setTransferMember(null)}
              open={!!transferMember}
              onOpenChange={(open) => { if (!open) setTransferMember(null); }}
            />
          </div>
        </div>
      )}

      {scopingMember && (
        <ClientScopingDialog
          userId={scopingMember.userId}
          userName={scopingMember.name}
        />
      )}
    </>
  );
}
