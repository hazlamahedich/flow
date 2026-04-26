import type { AgentId } from '@flow/types';

export type TrustLevel = 'supervised' | 'confirm' | 'auto';

export interface AgentIdentity {
  id: AgentId;
  tokenName: string;
  label: string;
  iconInitial: string;
  iconName: string;
  color: string;
}

export const AGENT_IDENTITY: Record<AgentId, AgentIdentity> = {
  inbox: {
    id: 'inbox',
    tokenName: '--flow-agent-inbox',
    label: 'Inbox',
    iconInitial: 'I',
    iconName: 'Mail',
    color: 'hsl(217, 91%, 73%)',
  },
  calendar: {
    id: 'calendar',
    tokenName: '--flow-agent-calendar',
    label: 'Calendar',
    iconInitial: 'C',
    iconName: 'Calendar',
    color: 'hsl(263, 85%, 75%)',
  },
  'ar-collection': {
    id: 'ar-collection',
    tokenName: '--flow-agent-ar',
    label: 'AR Collection',
    iconInitial: '$',
    iconName: 'DollarSign',
    color: 'hsl(33, 90%, 61%)',
  },
  'weekly-report': {
    id: 'weekly-report',
    tokenName: '--flow-agent-report',
    label: 'Weekly Report',
    iconInitial: 'R',
    iconName: 'FileText',
    color: 'hsl(160, 65%, 51%)',
  },
  'client-health': {
    id: 'client-health',
    tokenName: '--flow-agent-health',
    label: 'Client Health',
    iconInitial: 'H',
    iconName: 'Heart',
    color: 'hsl(330, 85%, 72%)',
  },
  'time-integrity': {
    id: 'time-integrity',
    tokenName: '--flow-agent-time',
    label: 'Time Integrity',
    iconInitial: 'T',
    iconName: 'Clock',
    color: 'hsl(192, 80%, 55%)',
  },
} as const;

export const AGENT_IDS: readonly AgentId[] = [
  'inbox',
  'calendar',
  'ar-collection',
  'weekly-report',
  'client-health',
  'time-integrity',
] as const;

export type CadenceTier = 'high' | 'low' | 'ambient';

export const AGENT_CADENCE: Record<AgentId, CadenceTier> = {
  inbox: 'high',
  calendar: 'high',
  'ar-collection': 'low',
  'weekly-report': 'low',
  'client-health': 'low',
  'time-integrity': 'ambient',
};

export interface TrustLevelColorSet {
  bg: string;
  text: string;
  border: string;
}

export const TRUST_LEVEL_COLORS: Record<TrustLevel, TrustLevelColorSet> = {
  supervised: {
    bg: 'rgba(59, 130, 246, 0.12)',
    text: '#3b82f6',
    border: '#3b82f6',
  },
  confirm: {
    bg: 'rgba(187, 134, 252, 0.12)',
    text: 'hsl(263, 85%, 75%)',
    border: 'hsl(263, 85%, 75%)',
  },
  auto: {
    bg: 'rgba(22, 163, 74, 0.12)',
    text: '#16a34a',
    border: 'transparent',
  },
};
