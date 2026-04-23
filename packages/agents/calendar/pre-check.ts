import type { CalendarProposal } from './schemas';

export async function preCheck(_proposal: CalendarProposal): Promise<{
  passed: boolean;
  errors: string[];
}> {
  throw new Error('calendar.preCheck not implemented');
}
