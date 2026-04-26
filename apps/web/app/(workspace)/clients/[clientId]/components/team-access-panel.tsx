'use client';

import { TeamAccessPlaceholder } from './team-access-placeholder';

interface TeamAccessPanelProps {
  clientId: string;
  workspaceId: string;
}

export function TeamAccessPanel({ clientId: _clientId, workspaceId: _workspaceId }: TeamAccessPanelProps) {
  return <TeamAccessPlaceholder />;
}
