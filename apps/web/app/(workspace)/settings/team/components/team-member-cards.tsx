'use client';

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

interface TeamMemberCardsProps {
  members: TeamMember[];
  canManageRoles: boolean;
  canRevoke: boolean;
  canTransfer: boolean;
  updatingRole: string | null;
  onRoleChange: (memberId: string, newRole: string, currentRole: string) => void;
  onRevoke: (member: TeamMember) => void;
  onTransfer: (member: TeamMember) => void;
}

function getAvailableRoles(currentRole: string): string[] {
  if (currentRole === 'owner') return ['owner'];
  return ['admin', 'member'];
}

export function TeamMemberCards({
  members,
  canManageRoles,
  canRevoke,
  canTransfer,
  updatingRole,
  onRoleChange,
  onRevoke,
  onTransfer,
}: TeamMemberCardsProps) {
  return (
    <div className="space-y-3 md:hidden">
      {members.map((member) => (
        <div
          key={member.id}
          className="rounded-lg border border-[var(--flow-color-border-default)] p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-[var(--flow-color-text-primary)]">{member.name}</div>
              <div className="text-xs text-[var(--flow-color-text-secondary)]">{member.email}</div>
            </div>
            {canManageRoles && member.role !== 'owner' ? (
              <select
                value={member.role}
                onChange={(e) => onRoleChange(member.id, e.target.value, member.role)}
                disabled={updatingRole === member.id}
                aria-label={`Change role for ${member.name}`}
                className="rounded-md border border-[var(--flow-color-border-default)] px-2 py-1 text-sm"
              >
                {getAvailableRoles(member.role).map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            ) : (
              <span className="capitalize text-sm text-[var(--flow-color-text-secondary)]" aria-label={`Role: ${member.role}`}>
                {member.role}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {canRevoke && member.role !== 'owner' && (
              <button
                type="button"
                onClick={() => onRevoke(member)}
                aria-label={`Remove ${member.name} from workspace`}
                className="rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
              >
                Remove
              </button>
            )}
            {canTransfer && member.role !== 'owner' && (
              <button
                type="button"
                onClick={() => onTransfer(member)}
                aria-label={`Transfer ownership to ${member.name}`}
                className="rounded-md border border-[var(--flow-color-border-default)] px-3 py-1 text-xs font-medium text-[var(--flow-color-text-primary)] hover:bg-[var(--flow-color-bg-secondary)]"
              >
                Transfer
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
