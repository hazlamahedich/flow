import type { CalendarInput, CalendarProposal } from './schemas';

export async function execute(_input: CalendarInput): Promise<CalendarProposal> {
  throw new Error('calendar.execute not implemented');
}
