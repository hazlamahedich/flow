import type { CalendarProvider } from './calendar-provider.js';
import type { EmailProvider } from './email-provider.js';
import { GoogleCalendarProvider } from './google-calendar/google-calendar-provider.js';

export type ProviderFactory = () => CalendarProvider | EmailProvider;

const registry = new Map<string, ProviderFactory>();

function key(type: string, name: string): string {
  return `${type}:${name}`;
}

export function registerProvider(
  type: string,
  name: string,
  factory: ProviderFactory,
): void {
  registry.set(key(type, name), factory);
}

export function getProvider(
  type: string,
  name: string,
): CalendarProvider | EmailProvider {
  const factory = registry.get(key(type, name));
  if (!factory) {
    throw new Error(
      `No provider registered for ${key(type, name)}. ` +
        `Registered providers: [${Array.from(registry.keys()).join(', ')}]`,
    );
  }
  return factory();
}

export function getCalendarProvider(name: string): CalendarProvider {
  return getProvider('calendar', name) as CalendarProvider;
}

// Auto-register built-in providers
registerProvider(
  'calendar',
  'google_calendar',
  () => new GoogleCalendarProvider(),
);
