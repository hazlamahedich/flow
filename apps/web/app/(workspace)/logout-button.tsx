'use client';

import { logout } from '@/app/(auth)/login/actions/logout';

export function LogoutButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="rounded-md border border-[var(--flow-color-border-default)] px-3 py-1 text-xs text-[var(--flow-color-text-tertiary)] transition-colors hover:bg-[var(--flow-color-bg-tertiary)]"
      >
        Sign out
      </button>
    </form>
  );
}
