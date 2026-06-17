import type { OAuthTokens } from '@flow/types';

export interface PaymentCustomer {
  providerCustomerId: string;
  email: string;
  name: string;
  metadata?: Record<string, string>;
}

export interface PaymentMethod {
  providerPaymentMethodId: string;
  type: 'card' | 'bank_transfer';
  last4: string;
  brand: string | undefined;
  expiryMonth: number | undefined;
  expiryYear: number | undefined;
  isDefault: boolean;
}

export interface PaymentIntent {
  providerPaymentIntentId: string;
  amount: number;
  currency: string;
  status: 'requires_payment_method' | 'requires_confirmation' | 'processing' | 'succeeded' | 'failed' | 'cancelled';
  clientSecret: string | undefined;
  metadata: Record<string, string> | undefined;
}

export interface SubscriptionPlan {
  providerPriceId: string;
  name: string;
  amount: number;
  currency: string;
  interval: 'month' | 'year';
  features: string[];
}

export interface Subscription {
  providerSubscriptionId: string;
  customerId: string;
  priceId: string;
  status: 'active' | 'past_due' | 'cancelled' | 'incomplete' | 'trialing' | 'paused';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

export interface Invoice {
  providerInvoiceId: string;
  customerId: string;
  subscriptionId: string | undefined;
  amountDue: number;
  amountPaid: number;
  currency: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  hostedInvoiceUrl: string | undefined;
  pdfUrl: string | undefined;
  dueDate: string | undefined;
  paidAt: string | undefined;
  lineItems: InvoiceLineItem[];
}

export interface InvoiceLineItem {
  description: string;
  amount: number;
  quantity: number;
  metadata?: Record<string, string>;
}

export interface WebhookEvent {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface Refund {
  providerRefundId: string;
  paymentIntentId: string;
  amount: number;
  reason: 'duplicate' | 'fraudulent' | 'requested_by_customer' | 'expired_uncaptured_charge';
  status: 'pending' | 'succeeded' | 'failed' | 'canceled';
}

export interface CheckoutSession {
  url: string;
  sessionId: string;
}

export interface PortalSession {
  url: string;
}

export interface PaymentProvider {
  getProviderName(): string;

  createCustomer(params: {
    email: string;
    name: string;
    workspaceId: string;
    metadata?: Record<string, string>;
    idempotencyKey?: string;
  }): Promise<PaymentCustomer>;

  getCustomer(customerId: string): Promise<PaymentCustomer | null>;
  updateCustomer(customerId: string, params: { email?: string; name?: string; metadata?: Record<string, string> }): Promise<PaymentCustomer>;

  listPaymentMethods(customerId: string): Promise<PaymentMethod[]>;
  attachPaymentMethod(customerId: string, paymentMethodId: string): Promise<PaymentMethod>;
  detachPaymentMethod(paymentMethodId: string): Promise<void>;
  setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<void>;

  createPaymentIntent(params: {
    customerId: string;
    amount: number;
    currency: string;
    metadata?: Record<string, string>;
    idempotencyKey?: string;
  }): Promise<PaymentIntent>;

  getPaymentIntent(paymentIntentId: string): Promise<PaymentIntent>;
  capturePaymentIntent(paymentIntentId: string, amountToCapture?: number): Promise<PaymentIntent>;
  cancelPaymentIntent(paymentIntentId: string): Promise<PaymentIntent>;

  createCheckoutSession(params: {
    amountCents: number;
    currency: string;
    invoiceNumber: string;
    metadata: Record<string, string>;
    successUrl: string;
    cancelUrl: string;
    expiresAt?: number;
    idempotencyKey?: string;
  }): Promise<CheckoutSession>;

  /**
   * Subscription Checkout Session (Story 9.3b — FR55).
   *
   * Distinct from {@link createCheckoutSession} (which is one-time `mode=payment`
   * for invoices): this creates `mode=subscription` checkout sessions with a
   * recurring price line item. Metadata is written to BOTH the Checkout Session
   * and the resulting Subscription (`subscription_data.metadata`) so the
   * `checkout.session.completed` webhook handler (9-3a) and the
   * `customer.subscription.updated` handler can both read `workspace_id`.
   */
  createSubscriptionCheckoutSession(params: {
    customerId: string;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
    metadata: Record<string, string>;
    idempotencyKey?: string;
  }): Promise<CheckoutSession>;

  /**
   * Stripe Customer Portal Session (Story 9.3b — FR58).
   *
   * Returns a short-lived URL to Stripe's hosted Customer Portal where the
   * customer can self-manage payment methods, view invoice history, and
   * cancel their subscription (per the portal configuration created once
   * in the Stripe Dashboard — see Dev Notes).
   */
  createPortalSession(params: {
    customerId: string;
    returnUrl: string;
    configuration?: string;
  }): Promise<PortalSession>;

  /**
   * Read a Checkout Session by ID with the subscription expanded (Story 9.3b, AC4 — FR42).
   *
   * Used by `syncStripeDataAction` as the success-redirect fallback: when a
   * workspace has no local `stripe_subscription_id` yet, the action looks up
   * the checkout session by the `{CHECKOUT_SESSION_ID}` Stripe appended to
   * the success URL, resolves the resulting subscription, verifies the
   * customer matches, and upserts via the idempotent RPC.
   */
  getCheckoutSession(sessionId: string): Promise<{ subscriptionId: string | null; customerId: string | null }>;

  createSubscription(params: {
    customerId: string;
    priceId: string;
    trialDays?: number;
    metadata?: Record<string, string>;
  }): Promise<Subscription>;

  getSubscription(subscriptionId: string): Promise<Subscription>;
  updateSubscription(subscriptionId: string, params: { priceId?: string; prorationBehavior?: 'create_prorations' | 'none' }): Promise<Subscription>;
  cancelSubscription(subscriptionId: string, immediately?: boolean): Promise<Subscription>;
  resumeSubscription(subscriptionId: string): Promise<Subscription>;

  createInvoice(params: {
    customerId: string;
    subscriptionId?: string;
    dueDate?: string;
    metadata?: Record<string, string>;
    lineItems: InvoiceLineItem[];
    currency?: string;
  }): Promise<Invoice>;

  getInvoice(invoiceId: string): Promise<Invoice>;
  listInvoices(customerId: string, limit?: number): Promise<Invoice[]>;
  payInvoice(invoiceId: string): Promise<Invoice>;
  voidInvoice(invoiceId: string): Promise<Invoice>;

  createRefund(params: {
    paymentIntentId: string;
    amount: number;
    reason: Refund['reason'];
  }): Promise<Refund>;

  verifyWebhookSignature(payload: string, signature: string, secret: string): Promise<WebhookEvent>;
  constructWebhookEvent(payload: string, signature: string, secret: string): WebhookEvent;
}

export type { OAuthTokens };
