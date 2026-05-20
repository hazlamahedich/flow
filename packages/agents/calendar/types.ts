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

export type SchedulingRequestSourceType = 'email_extraction' | 'va_manual' | 'client_portal';
export type SchedulingRequestType = 'book_new' | 'reschedule' | 'cancel' | 'check_availability';
export type SchedulingRequestStatus = 'pending' | 'options_proposed' | 'option_selected' | 'booked' | 'failed' | 'cancelled';

export interface SchedulingRequest {
  id: string;
  workspaceId: string;
  clientId: string;
  sourceEmailId: string | null;
  sourceType: SchedulingRequestSourceType;
  requestType: SchedulingRequestType;
  requestedBy: Record<string, unknown>;
  requestedSlots: Record<string, unknown>[] | null;
  durationMinutes: number | null;
  preferences: Record<string, unknown>;
  status: SchedulingRequestStatus;
  proposedOptions: BookingProposal[];
  selectedOption: number | null;
  bookedEventId: string | null;
  agentRunId: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface BookingProposal {
  startAt: string;
  endAt: string;
  conflicts: number;
  reasoning: string;
}

export interface AvailableSlot {
  startAt: string;
  endAt: string;
  conflicts: number;
  calendarId: string;
  reasoning: string;
}

export interface BookingProposalResult {
  schedulingRequestId: string;
  proposedOptions: BookingProposal[];
  status: SchedulingRequestStatus;
}

export interface CreateEventResult {
  schedulingRequestId: string;
  eventId: string;
  providerEventId: string;
  status: SchedulingRequestStatus;
}
