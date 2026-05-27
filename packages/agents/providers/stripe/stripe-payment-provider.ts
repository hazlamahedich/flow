
import type {
  PaymentProvider,
  PaymentCustomer,
  PaymentMethod,
  PaymentIntent,
  Subscription,
  Invoice,
  InvoiceLineItem,
  Refund,
  WebhookEvent,
  CheckoutSession,
} from '../payment-provider.js';
import crypto from 'node:crypto';

const STRIPE_API_BASE = 'https://api.stripe.com/v1';

interface StripeConfig {
  secretKey: string;
  webhookSecret: string;
  apiVersion?: string;
}

export class StripePaymentProvider implements PaymentProvider {
  private readonly config: StripeConfig;

  constructor(config: StripeConfig) {
    if (!config.secretKey.startsWith('sk_')) {
      throw new Error('Stripe secret key must start with sk_');
    }
    this.config = config;
  }

  getProviderName(): string {
    return 'stripe';
  }

  private async stripeRequest<T>(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    body?: Record<string, unknown>,
    idempotencyKey?: string,
  ): Promise<T> {
    const url = `${STRIPE_API_BASE}${path}`;
    const options: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${this.config.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      },
    };

    if (body && method !== 'GET') {
      options.body = new URLSearchParams(
        flattenForForm(body),
      ).toString();
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new StripeApiError(
        (error as { error?: { message?: string } })?.error?.message ?? `Stripe API error: ${response.status}`,
        response.status,
        path,
      );
    }

    return response.json() as Promise<T>;
  }

  async createCustomer(params: {
    email: string;
    name: string;
    workspaceId: string;
    metadata?: Record<string, string>;
  }): Promise<PaymentCustomer> {
    const result = await this.stripeRequest<StripeCustomer>('POST', '/customers', {
      email: params.email,
      name: params.name,
      metadata: { workspace_id: params.workspaceId, ...params.metadata },
    });
    return mapCustomer(result);
  }

  async getCustomer(customerId: string): Promise<PaymentCustomer | null> {
    try {
      const result = await this.stripeRequest<StripeCustomer>('GET', `/customers/${customerId}`);
      return mapCustomer(result);
    } catch (error) {
      if (error instanceof StripeApiError && error.statusCode === 404) return null;
      throw error;
    }
  }

  async updateCustomer(
    customerId: string,
    params: { email?: string; name?: string; metadata?: Record<string, string> },
  ): Promise<PaymentCustomer> {
    const result = await this.stripeRequest<StripeCustomer>('POST', `/customers/${customerId}`, {
      ...(params.email ? { email: params.email } : {}),
      ...(params.name ? { name: params.name } : {}),
      ...(params.metadata ? { metadata: params.metadata } : {}),
    });
    return mapCustomer(result);
  }

  async listPaymentMethods(customerId: string): Promise<PaymentMethod[]> {
    const result = await this.stripeRequest<StripeListResponse<StripePaymentMethod>>(
      'GET',
      `/payment_methods?customer=${customerId}&type=card`,
    );
    return result.data.map(mapPaymentMethod);
  }

  async attachPaymentMethod(customerId: string, paymentMethodId: string): Promise<PaymentMethod> {
    await this.stripeRequest('POST', `/payment_methods/${paymentMethodId}/attach`, {
      customer: customerId,
    });
    const result = await this.stripeRequest<StripePaymentMethod>('GET', `/payment_methods/${paymentMethodId}`);
    return mapPaymentMethod(result);
  }

  async detachPaymentMethod(paymentMethodId: string): Promise<void> {
    await this.stripeRequest('POST', `/payment_methods/${paymentMethodId}/detach`);
  }

  async setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<void> {
    await this.stripeRequest('POST', `/customers/${customerId}`, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });
  }

  async createPaymentIntent(params: {
    customerId: string;
    amount: number;
    currency: string;
    metadata?: Record<string, string>;
    idempotencyKey?: string;
  }): Promise<PaymentIntent> {
    const result = await this.stripeRequest<StripePaymentIntent>('POST', '/payment_intents', {
      customer: params.customerId,
      amount: params.amount,
      currency: params.currency,
      metadata: params.metadata,
      automatic_payment_methods: { enabled: true },
    });
    return mapPaymentIntent(result);
  }

  async createCheckoutSession(params: {
    amountCents: number;
    currency: string;
    invoiceNumber: string;
    metadata: Record<string, string>;
    successUrl: string;
    cancelUrl: string;
    expiresAt?: number;
    idempotencyKey?: string;
  }): Promise<CheckoutSession> {
    const result = await this.stripeRequest<StripeCheckoutSession>('POST', '/checkout/sessions', {
      line_items: [
        {
          price_data: {
            currency: params.currency,
            unit_amount: params.amountCents,
            product_data: { name: `Invoice ${params.invoiceNumber}` },
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: params.metadata,
      payment_intent_data: { metadata: params.metadata },
      ...(params.expiresAt ? { expires_at: params.expiresAt } : {}),
    }, params.idempotencyKey);

    if (!result.url) {
      throw new StripeApiError('Stripe checkout session returned no URL', 0, '/checkout/sessions');
    }

    return { url: result.url, sessionId: result.id };
  }

  async getPaymentIntent(paymentIntentId: string): Promise<PaymentIntent> {
    const result = await this.stripeRequest<StripePaymentIntent>('GET', `/payment_intents/${paymentIntentId}`);
    return mapPaymentIntent(result);
  }

  async capturePaymentIntent(paymentIntentId: string, amountToCapture?: number): Promise<PaymentIntent> {
    const body: Record<string, unknown> = {};
    if (amountToCapture !== undefined) {
      body.amount_to_capture = amountToCapture;
    }
    const result = await this.stripeRequest<StripePaymentIntent>('POST', `/payment_intents/${paymentIntentId}/capture`, body);
    return mapPaymentIntent(result);
  }

  async cancelPaymentIntent(paymentIntentId: string): Promise<PaymentIntent> {
    const result = await this.stripeRequest<StripePaymentIntent>('POST', `/payment_intents/${paymentIntentId}/cancel`);
    return mapPaymentIntent(result);
  }

  async createSubscription(params: {
    customerId: string;
    priceId: string;
    trialDays?: number;
    metadata?: Record<string, string>;
  }): Promise<Subscription> {
    const body: Record<string, unknown> = {
      customer: params.customerId,
      items: [{ price: params.priceId }],
      metadata: params.metadata,
    };
    if (params.trialDays) {
      body.trial_period_days = params.trialDays;
    }
    const result = await this.stripeRequest<StripeSubscription>('POST', '/subscriptions', body);
    return mapSubscription(result);
  }

  async getSubscription(subscriptionId: string): Promise<Subscription> {
    const result = await this.stripeRequest<StripeSubscription>('GET', `/subscriptions/${subscriptionId}`);
    return mapSubscription(result);
  }

  async updateSubscription(
    subscriptionId: string,
    params: { priceId?: string; prorationBehavior?: 'create_prorations' | 'none' },
  ): Promise<Subscription> {
    const body: Record<string, unknown> = {};
    if (params.priceId) {
      body.items = [{ price: params.priceId }];
    }
    if (params.prorationBehavior) {
      body.proration_behavior = params.prorationBehavior;
    }
    const result = await this.stripeRequest<StripeSubscription>('POST', `/subscriptions/${subscriptionId}`, body);
    return mapSubscription(result);
  }

  async cancelSubscription(subscriptionId: string, immediately = false): Promise<Subscription> {
    const result = await this.stripeRequest<StripeSubscription>('DELETE', `/subscriptions/${subscriptionId}`, {
      ...(immediately ? { at_period_end: false } : { at_period_end: true }),
    });
    return mapSubscription(result);
  }

  async resumeSubscription(subscriptionId: string): Promise<Subscription> {
    const result = await this.stripeRequest<StripeSubscription>('POST', `/subscriptions/${subscriptionId}`, {
      cancel_at_period_end: false,
    });
    return mapSubscription(result);
  }

  async createInvoice(params: {
    customerId: string;
    subscriptionId?: string;
    dueDate?: string;
    metadata?: Record<string, string>;
    lineItems: InvoiceLineItem[];
    currency?: string;
  }): Promise<Invoice> {
    const invoiceCurrency = params.currency ?? 'usd';
    const draft = await this.stripeRequest<StripeInvoice>('POST', '/invoices', {
      customer: params.customerId,
      subscription: params.subscriptionId,
      due_date: params.dueDate ? Math.floor(new Date(params.dueDate).getTime() / 1000) : undefined,
      metadata: params.metadata,
    });

    for (const item of params.lineItems) {
      await this.stripeRequest('POST', '/invoice_items', {
        customer: params.customerId,
        invoice: draft.id,
        amount: item.amount,
        currency: invoiceCurrency,
        description: item.description,
        quantity: item.quantity,
        metadata: item.metadata,
      });
    }

    const finalized = await this.stripeRequest<StripeInvoice>('POST', `/invoices/${draft.id}/finalize`);
    return mapInvoice(finalized);
  }

  async getInvoice(invoiceId: string): Promise<Invoice> {
    const result = await this.stripeRequest<StripeInvoice>('GET', `/invoices/${invoiceId}`);
    return mapInvoice(result);
  }

  async listInvoices(customerId: string, limit = 25): Promise<Invoice[]> {
    const result = await this.stripeRequest<StripeListResponse<StripeInvoice>>(
      'GET',
      `/invoices?customer=${customerId}&limit=${limit}`,
    );
    return result.data.map(mapInvoice);
  }

  async payInvoice(invoiceId: string): Promise<Invoice> {
    const result = await this.stripeRequest<StripeInvoice>('POST', `/invoices/${invoiceId}/pay`);
    return mapInvoice(result);
  }

  async voidInvoice(invoiceId: string): Promise<Invoice> {
    const result = await this.stripeRequest<StripeInvoice>('POST', `/invoices/${invoiceId}/void`);
    return mapInvoice(result);
  }

  async createRefund(params: {
    paymentIntentId: string;
    amount: number;
    reason: Refund['reason'];
  }): Promise<Refund> {
    const result = await this.stripeRequest<StripeRefund>('POST', '/refunds', {
      payment_intent: params.paymentIntentId,
      amount: params.amount,
      reason: params.reason,
    });
    return mapRefund(result);
  }

  async verifyWebhookSignature(
    _payload: string,
    _signature: string,
    _secret: string,
  ): Promise<WebhookEvent> {
    throw new Error('Deprecated: use constructWebhookEvent instead');
  }

  constructWebhookEvent(payload: string, signature: string, secret: string): WebhookEvent {
    const parsed = parseStripeSignature(signature);
    if (!parsed) {
      throw new StripeApiError('Invalid Stripe-Signature header format', 400, 'webhook');
    }
    const { timestamp, signatures } = parsed;

    // Reject if timestamp > 5 minutes old (Stripe spec tolerance)
    const now = Math.floor(Date.now() / 1000);
    if (now - timestamp > 300) {
      throw new StripeApiError('Stripe-Signature timestamp expired', 400, 'webhook');
    }

    const expected = this.computeSignature(timestamp, payload, secret);
    const matched = signatures.some((sig) => this.secureCompare(expected, sig));
    if (!matched) {
      throw new StripeApiError('Invalid webhook signature', 400, 'webhook');
    }

    // Parse payload as WebhookEvent
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(payload) as Record<string, unknown>;
    } catch {
      throw new StripeApiError('Invalid JSON payload', 400, 'webhook');
    }

    const id = typeof event.id === 'string' && event.id.length > 0 ? event.id : '';
    const type = typeof event.type === 'string' ? event.type : '';
    const created = typeof event.created === 'number' ? event.created : timestamp;

    if (!id) {
      throw new StripeApiError('Stripe event missing id field', 400, 'webhook');
    }

    return {
      id,
      type,
      payload: event,
      createdAt: new Date(created * 1000).toISOString(),
    };
  }

  private computeSignature(timestamp: number, payload: string, secret: string): string {
    const signedPayload = `${timestamp}.${payload}`;
    return crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
  }

  private secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    try {
      const bufA = Buffer.from(a, 'hex');
      const bufB = Buffer.from(b, 'hex');
      if (bufA.length !== bufB.length) return false;
      return crypto.timingSafeEqual(bufA, bufB);
    } catch {
      return false;
    }
  }
}

export class StripeApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly path: string,
  ) {
    super(message);
    this.name = 'StripeApiError';
  }
}

function flattenForForm(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const formKey = prefix ? `${prefix}[${key}]` : key;
    if (value === undefined || value === null) continue;
    if (typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenForForm(value as Record<string, unknown>, formKey));
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item === 'object' && item !== null) {
          Object.assign(result, flattenForForm(item as Record<string, unknown>, `${formKey}[${index}]`));
        } else {
          result[`${formKey}[${index}]`] = String(item);
        }
      });
    } else {
      result[formKey] = String(value);
    }
  }
  return result;
}

interface StripeListResponse<T> { data: T[]; has_more: boolean; }
interface StripeCustomer { id: string; email: string; name: string; metadata: Record<string, string>; }
interface StripePaymentMethod { id: string; type: string; card?: { brand: string; last4: string; exp_month: number; exp_year: number }; }
interface StripePaymentIntent { id: string; amount: number; currency: string; status: string; client_secret?: string; metadata: Record<string, string>; }
interface StripeCheckoutSession { id: string; url: string; }
interface StripeSubscription { id: string; customer: string; items: { data: Array<{ price: { id: string } }> }; status: string; current_period_start: number; current_period_end: number; cancel_at_period_end: boolean; metadata: Record<string, string>; }
interface StripeInvoice { id: string; customer: string; subscription?: string; amount_due: number; amount_paid: number; currency: string; status: string; hosted_invoice_url?: string; invoice_pdf?: string; due_date?: number; status_transitions?: { paid_at?: number }; lines: { data: Array<{ description: string; amount: number; quantity: number; metadata: Record<string, string> }> }; }
interface StripeRefund { id: string; payment_intent: string; amount: number; reason: string; status: string; }

function mapCustomer(c: StripeCustomer): PaymentCustomer {
  return { providerCustomerId: c.id, email: c.email, name: c.name, metadata: c.metadata };
}
function mapPaymentMethod(pm: StripePaymentMethod): PaymentMethod {
  return {
    providerPaymentMethodId: pm.id,
    type: pm.type === 'card' ? 'card' : 'bank_transfer',
    last4: pm.card?.last4 ?? '????',
    brand: pm.card?.brand,
    expiryMonth: pm.card?.exp_month,
    expiryYear: pm.card?.exp_year,
    isDefault: false,
  };
}
function mapPaymentIntent(pi: StripePaymentIntent): PaymentIntent {
  return {
    providerPaymentIntentId: pi.id,
    amount: pi.amount,
    currency: pi.currency,
    status: pi.status as PaymentIntent['status'],
    clientSecret: pi.client_secret,
    metadata: pi.metadata,
  };
}
function mapSubscription(s: StripeSubscription): Subscription {
  return {
    providerSubscriptionId: s.id,
    customerId: typeof s.customer === 'string' ? s.customer : '',
    priceId: s.items.data[0]?.price.id ?? '',
    status: s.status as Subscription['status'],
    currentPeriodStart: new Date(s.current_period_start * 1000).toISOString(),
    currentPeriodEnd: new Date(s.current_period_end * 1000).toISOString(),
    cancelAtPeriodEnd: s.cancel_at_period_end,
  };
}
function mapInvoice(inv: StripeInvoice): Invoice {
  return {
    providerInvoiceId: inv.id,
    customerId: typeof inv.customer === 'string' ? inv.customer : '',
    subscriptionId: inv.subscription ?? undefined,
    amountDue: inv.amount_due,
    amountPaid: inv.amount_paid,
    currency: inv.currency,
    status: inv.status as Invoice['status'],
    hostedInvoiceUrl: inv.hosted_invoice_url ?? undefined,
    pdfUrl: inv.invoice_pdf ?? undefined,
    dueDate: inv.due_date ? new Date(inv.due_date * 1000).toISOString() : undefined,
    paidAt: inv.status_transitions?.paid_at ? new Date(inv.status_transitions.paid_at * 1000).toISOString() : undefined,
    lineItems: inv.lines.data.map((l) => ({
      description: l.description,
      amount: l.amount,
      quantity: l.quantity,
      metadata: l.metadata,
    })),
  };
}
function mapRefund(r: StripeRefund): Refund {
  return {
    providerRefundId: r.id,
    paymentIntentId: r.payment_intent,
    amount: r.amount,
    reason: r.reason as Refund['reason'],
    status: r.status as Refund['status'],
  };
}

function parseStripeSignature(signature: string): { timestamp: number; signatures: string[] } | null {
  const parts = signature.split(',').map((p) => p.trim());
  let timestamp: number | null = null;
  const signatures: string[] = [];
  for (const part of parts) {
    if (part.startsWith('t=')) {
      const tVal = part.slice(2);
      const parsed = Number.parseInt(tVal, 10);
      if (Number.isNaN(parsed) || tVal !== String(parsed)) continue;
      timestamp = parsed;
    } else if (part.startsWith('v1=')) {
      signatures.push(part.slice(3));
    }
  }
  if (timestamp === null || signatures.length === 0) return null;
  return { timestamp, signatures };
}
