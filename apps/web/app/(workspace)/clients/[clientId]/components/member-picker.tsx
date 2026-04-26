'use client';

import { useState } from 'react';

interface MemberPickerProps {
  clientId: string;
  workspaceId: string;
  existingMemberIds: string[];
}

export function MemberPicker({ clientId: _clientId, workspaceId: _workspaceId, existingMemberIds: _existingMemberIds }: MemberPickerProps) {
  const [email, setEmail] = useState('');
  const [isPending, setIsPending] = useState(false);

  const handleAssign = async () => {
    if (!email.trim()) return;
    setIsPending(true);
    setEmail('');
    setIsPending(false);
  };

  return (
    <div className="flex items-end gap-2">
      <div className="flex-1">
        <label htmlFor="member-email" className="mb-1 block text-sm font-medium">
          Add team member
        </label>
        <input
          id="member-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="member@example.com"
          className="h-10 w-full rounded-md border border-[var(--flow-color-border-default)] px-3 text-sm"
        />
      </div>
      <button
        onClick={handleAssign}
        disabled={isPending || !email.trim()}
        className="h-10 rounded-md bg-[var(--flow-color-bg-brand)] px-4 text-sm font-medium text-white disabled:opacity-50"
      >
        {isPending ? 'Adding...' : 'Assign'}
      </button>
    </div>
  );
}
