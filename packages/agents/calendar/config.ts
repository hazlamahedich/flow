import type {
  CalendarAgentConfig,
  CalendarActionType,
  CalendarTrustLevels,
} from './types';

export const CALENDAR_AGENT_ID = 'calendar' as const;

export const DEFAULT_CALENDAR_CONFIG: CalendarAgentConfig = {
  defaultMeetingDuration: 30,
  bufferMinutes: 15,
  workingHours: { start: '09:00', end: '17:00' },
  workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  timezone: 'America/New_York',
  autoDetectBypass: true,
  bypassAlertThreshold: 0.8,
  travelBufferMinutes: 30,
};

export const CALENDAR_TRUST_LEVELS: CalendarTrustLevels = {
  findAvailableSlots: 0,
  proposeBooking: 0,
  detectConflict: 0,
  detectBypass: 0,
  resolveCascade: 1,
  createEvent: 3,
  cancelEvent: 3,
};

export const CALENDAR_AGENT_ACTIONS: readonly CalendarActionType[] = [
  'findAvailableSlots',
  'proposeBooking',
  'detectConflict',
  'detectBypass',
  'resolveCascade',
  'createEvent',
  'cancelEvent',
] as const;
