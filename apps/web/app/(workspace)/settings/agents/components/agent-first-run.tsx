'use client';

import { Card, CardHeader, CardContent, Button } from '@flow/ui';
import Link from 'next/link';

interface AgentFirstRunProps {
  agents: Array<{ id: string; label: string; description: string; icon: string }>;
}

export function AgentFirstRun({ agents }: AgentFirstRunProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--flow-color-text-secondary)]">
        Get started by activating your first AI agent. We recommend starting with Inbox.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {agents.map((agent, index) => (
          <Card key={agent.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <span
                  className="flex h-6 w-6 items-center justify-center rounded text-xs font-semibold"
                  style={{
                    backgroundColor: `color-mix(in srgb, var(--flow-agent-${agent.icon}) 15%, transparent)`,
                    color: `var(--flow-agent-${agent.icon})`,
                  }}
                >
                  {index + 1}
                </span>
                <span className="text-sm font-medium text-[var(--flow-color-text-primary)]">
                  {agent.label}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-[var(--flow-color-text-secondary)]">
                {agent.description}
              </p>
              <Link href={`/settings/agents/${agent.id}`}>
                <Button
                  variant={index === 0 ? 'default' : 'outline'}
                  size="sm"
                  className="mt-3"
                >
                  {index === 0 ? 'Start here' : 'Configure'}
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
