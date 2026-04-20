export const agentColors = {
  '--flow-agent-inbox': 'hsl(217, 91%, 73%)',
  '--flow-agent-calendar': 'hsl(263, 85%, 75%)',
  '--flow-agent-ar': 'hsl(33, 90%, 61%)',
  '--flow-agent-report': 'hsl(160, 65%, 51%)',
  '--flow-agent-health': 'hsl(330, 85%, 72%)',
  '--flow-agent-time': 'hsl(217, 89%, 69%)',
} as const;

export type AgentName = 'inbox' | 'calendar' | 'ar' | 'report' | 'health' | 'time';

export const agentNames: readonly AgentName[] = [
  'inbox',
  'calendar',
  'ar',
  'report',
  'health',
  'time',
] as const;

export type AgentColors = typeof agentColors;
