'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '../ui/popover';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '../ui/command';
import { cn } from '../../lib/utils';
import type { TimerShellProps } from './timer-types';

interface PickerSelection {
  clientId: string;
  clientName: string;
  projectId: string | null;
  projectName: string | null;
}

interface ProjectClientPickerProps {
  timerProps: TimerShellProps;
  onSelect: (selection: PickerSelection) => void;
  disabled?: boolean;
  collapsed?: boolean;
}

type PickerStep = 'idle' | 'client-list' | 'project-list';

export function ProjectClientPicker({
  timerProps,
  onSelect,
  disabled,
  collapsed,
}: ProjectClientPickerProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<PickerStep>('idle');
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string; clientId: string }[]>([]);
  const [selectedClient, setSelectedClient] = useState<{ id: string; name: string } | null>(null);
  const [search, setSearch] = useState('');
  // P5: ignore-flag refs to cancel stale responses from concurrent fetches
  const clientFetchIgnoreRef = useRef(false);
  const projectFetchIgnoreRef = useRef(false);

  // P3: reset step and selection when popover closes without completing selection
  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setStep('idle');
      setSelectedClient(null);
      setSearch('');
    }
  }, []);

  useEffect(() => {
    if (open && step === 'idle') {
      setStep('client-list');
      clientFetchIgnoreRef.current = false;
      timerProps.onListClients().then((result) => {
        if (!clientFetchIgnoreRef.current && result.success) {
          setClients(result.data);
        }
      });
      return () => {
        // P5: mark any in-flight fetch as stale when effect re-runs
        clientFetchIgnoreRef.current = true;
      };
    }
  }, [open, step, timerProps]);

  const handleSelectClient = useCallback(
    (client: { id: string; name: string }) => {
      setSelectedClient(client);
      setSearch('');
      setStep('project-list');
      setProjects([]); // clear stale list while new fetch is in-flight
      projectFetchIgnoreRef.current = false;
      timerProps.onListProjects(client.id).then((result) => {
        if (!projectFetchIgnoreRef.current && result.success) {
          setProjects(result.data);
        }
      });
    },
    [timerProps],
  );

  const handleSelectProject = useCallback(
    (project: { id: string; name: string } | null) => {
      setOpen(false);
      setStep('idle');
      setSearch('');
      if (selectedClient) {
        onSelect({
          clientId: selectedClient.id,
          clientName: selectedClient.name,
          projectId: project?.id ?? null,
          projectName: project?.name ?? null,
        });
      }
      setSelectedClient(null);
    },
    [selectedClient, onSelect],
  );

  const handleSkipProject = useCallback(() => {
    if (selectedClient) {
      handleSelectProject(null);
    }
  }, [selectedClient, handleSelectProject]);

  // P5: cancel any in-flight project fetch on unmount
  useEffect(() => {
    return () => {
      clientFetchIgnoreRef.current = true;
      projectFetchIgnoreRef.current = true;
    };
  }, []);

  if (collapsed) {
    return null;
  }

  const triggerLabel = selectedClient
    ? `${selectedClient.name}${projects.length > 0 ? ' · Pick project' : ''}`
    : 'Pick client';

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'w-full rounded-[var(--flow-radius-sm)] border border-[var(--flow-color-border-default)] bg-[var(--flow-color-bg-surface)] px-2 py-1.5 text-left text-xs text-[var(--flow-color-text-secondary)] hover:bg-[var(--flow-color-bg-surface-hover)] focus:outline focus:outline-[var(--flow-focus-ring-width)_solid_var(--flow-focus-ring-color)] disabled:opacity-50',
          )}
          data-testid="timer-client-picker-trigger"
        >
          {triggerLabel}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" side="top" align="start">
        {step === 'client-list' && (
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search clients..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>No clients found</CommandEmpty>
              <CommandGroup>
                {clients
                  .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
                  .map((client) => (
                    <CommandItem
                      key={client.id}
                      value={client.id}
                      onSelect={() => handleSelectClient(client)}
                    >
                      {client.name}
                    </CommandItem>
                  ))}
              </CommandGroup>
            </CommandList>
          </Command>
        )}
        {step === 'project-list' && (
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search projects (optional)..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>No projects found</CommandEmpty>
              <CommandGroup>
                <CommandItem value="__skip__" onSelect={handleSkipProject}>
                  <span className="text-[var(--flow-color-text-muted)]">
                    No project — {selectedClient?.name} only
                  </span>
                </CommandItem>
                {projects
                  .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
                  .map((project) => (
                    <CommandItem
                      key={project.id}
                      value={project.id}
                      onSelect={() => handleSelectProject(project)}
                    >
                      {project.name}
                    </CommandItem>
                  ))}
              </CommandGroup>
            </CommandList>
          </Command>
        )}
      </PopoverContent>
    </Popover>
  );
}
