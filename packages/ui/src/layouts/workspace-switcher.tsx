'use client';

import { useTransition } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDown, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

export interface WorkspaceItem {
  id: string;
  name: string;
  role: string;
}

export interface WorkspaceSwitcherProps {
  workspaces: WorkspaceItem[];
  activeWorkspaceId: string;
  onSwitch: (workspaceId: string) => Promise<void>;
}

export function WorkspaceSwitcher({ workspaces, activeWorkspaceId, onSwitch }: WorkspaceSwitcherProps) {
  const [isPending, startTransition] = useTransition();

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);

  if (workspaces.length <= 1) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-[var(--flow-color-text-primary)]">
        <span className="truncate">{activeWorkspace?.name ?? 'Workspace'}</span>
      </div>
    );
  }

  function handleSwitch(workspaceId: string) {
    if (workspaceId === activeWorkspaceId) return;
    startTransition(async () => {
      try {
        await onSwitch(workspaceId);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to switch workspace');
      }
    });
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className={cn(
          'flex w-full items-center gap-2 rounded-[var(--flow-radius-sm)] px-3 py-2 text-sm font-medium text-[var(--flow-color-text-primary)] transition-colors',
          'hover:bg-[var(--flow-state-overlay-hover)]',
          'focus-visible:outline focus-visible:outline-[var(--flow-focus-ring-width)_solid_var(--flow-focus-ring-color)] focus-visible:outline-offset-1',
          'disabled:opacity-50',
        )}
        disabled={isPending}
        aria-label="Switch workspace"
        data-testid="workspace-switcher-trigger"
      >
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        )}
        <span className="truncate">{activeWorkspace?.name ?? 'Workspace'}</span>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="z-50 min-w-[200px] rounded-[var(--flow-radius-lg)] border border-[var(--flow-color-border-default)] bg-[var(--flow-color-bg-surface-raised)] p-1 shadow-lg"
          sideOffset={4}
          align="start"
        >
          {workspaces.map((workspace) => (
            <DropdownMenu.Item
              key={workspace.id}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-[var(--flow-radius-sm)] px-3 py-2 text-sm outline-none transition-colors',
                'hover:bg-[var(--flow-state-overlay-hover)] focus-visible:bg-[var(--flow-state-overlay-hover)]',
                workspace.id === activeWorkspaceId
                  ? 'font-medium text-[var(--flow-color-text-primary)]'
                  : 'text-[var(--flow-color-text-secondary)]',
              )}
              onSelect={() => handleSwitch(workspace.id)}
              disabled={isPending}
            >
              <span className="truncate">{workspace.name}</span>
              {workspace.id === activeWorkspaceId && (
                <span className="ml-auto text-xs text-[var(--flow-color-text-tertiary)]">Active</span>
              )}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
