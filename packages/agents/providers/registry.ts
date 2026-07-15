import type { CalendarProvider } from './calendar-provider.js';
import type { EmailProvider } from './email-provider.js';
import type { PaymentProvider } from './payment-provider.js';
import type { TransactionalEmailProvider } from './transactional-email-provider.js';
import { GoogleCalendarProvider } from './google-calendar/google-calendar-provider.js';
import { ResendTransactionalProvider } from './resend/resend-transactional-provider.js';
import { StripePaymentProvider } from './stripe/stripe-payment-provider.js';

export type ProviderFactory = () =>
  | CalendarProvider
  | EmailProvider
  | PaymentProvider
  | TransactionalEmailProvider;

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
):
  | CalendarProvider
  | EmailProvider
  | PaymentProvider
  | TransactionalEmailProvider {
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

export function getPaymentProvider(name: string): PaymentProvider {
  return getProvider('payment', name) as PaymentProvider;
}

export function getTransactionalEmailProvider(
  name: string,
): TransactionalEmailProvider {
  return getProvider('transactionalEmail', name) as TransactionalEmailProvider;
}

// Auto-register built-in providers
registerProvider(
  'calendar',
  'google_calendar',
  () => new GoogleCalendarProvider(),
);

registerProvider('transactionalEmail', 'resend', () => {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY environment variable is not set');
  return new ResendTransactionalProvider(key);
});

registerProvider(
  'payment',
  'stripe',
  () =>
    new StripePaymentProvider({
      secretKey: process.env.STRIPE_SECRET_KEY ?? '',
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
    }),
);
