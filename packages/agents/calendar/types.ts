export interface WorkingHours {
  start: string;
  end: string;
}

export interface CalendarAgentConfig {
  defaultMeetingDuration: number;
  bufferMinutes: number;
  workingHours: WorkingHours;
  workingDays: string[];
  timezone: string;
  autoDetectBypass: boolean;
  bypassAlertThreshold: number;
  travelBufferMinutes: number;
}

export type CalendarActionType =
  | 'findAvailableSlots'
  | 'proposeBooking'
  | 'detectConflict'
  | 'detectBypass'
  | 'resolveCascade'
  | 'createEvent'
  | 'cancelEvent';

export interface CalendarTrustLevels {
  findAvailableSlots: number;
  proposeBooking: number;
  detectConflict: number;
  detectBypass: number;
  resolveCascade: number;
  createEvent: number;
  cancelEvent: number;
}
