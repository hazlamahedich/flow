'use client';

import { useAtomValue } from 'jotai';
import { TrustBadge } from '@flow/ui';
import { TRUST_BADGE_DISPLAY } from '@flow/trust';
import type { TrustBadgeState } from '@flow/trust';
import type { AgentId } from '@flow/types';
import { AGENT_IDENTITY } from '@flow/shared';
import { trustBadgeAtom } from '@/lib/atoms/trust';

interface TrustBadgeWrapperProps {
  workspaceId: string;
  agentId: AgentId;
  variant?: 'inline' | 'sidebar';
}

function getAnimState(state: TrustBadgeState): 'default' | 'promoting' | 'regressing' {
  if (state === 'promoting') return 'promoting';
  if (state === 'regressing') return 'regressing';
  return 'default';
}

export function TrustBadgeWrapper({ workspaceId, agentId, variant = 'inline' }: TrustBadgeWrapperProps) {
  const data = useAtomValue(trustBadgeAtom(workspaceId, agentId));
  if (!data) return null;

  const display = TRUST_BADGE_DISPLAY[data.state];
  const identity = AGENT_IDENTITY[agentId];

  return (
    <TrustBadge
      label={display.label}
      colorToken={display.colorToken}
      borderStyle={display.borderStyle}
      animState={getAnimState(data.state)}
      variant={variant}
      agentLabel={identity?.label}
    />
  );
}
