export type { EmailProvider } from './email-provider.js';
export type { CalendarProvider } from './calendar-provider.js';
export { GmailProvider } from './gmail/gmail-provider.js';
export { GoogleCalendarProvider } from './google-calendar/google-calendar-provider.js';
export { verifyGoogleOidcToken } from './gmail/gmail-verify.js';
export {
  registerProvider,
  getProvider,
  getCalendarProvider,
  type ProviderFactory,
} from './registry.js';
