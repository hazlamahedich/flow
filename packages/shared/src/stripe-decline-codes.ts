// Static mapping of Stripe decline codes to user-friendly messages and retryability
// Source: Story 7.5 AC3 — PCI-DSS compliant, no card data stored

export interface DeclineCodeInfo {
  message: string;
  retryable: boolean;
}

const DECLINE_CODE_MAP: Record<string, DeclineCodeInfo> = {
  card_declined: {
    message: 'The card was declined. Try a different payment method.',
    retryable: false,
  },
  insufficient_funds: {
    message: 'The card has insufficient funds.',
    retryable: false,
  },
  expired_card: {
    message: 'The card has expired. Please update the card details.',
    retryable: false,
  },
  incorrect_cvc: {
    message: 'The security code is incorrect. Check and try again.',
    retryable: false,
  },
  processing_error: {
    message: 'A temporary payment processing error occurred. Please retry.',
    retryable: true,
  },
  issuer_declined: {
    message: 'The card issuer declined the payment. Please contact your bank.',
    retryable: true,
  },
};

const DEFAULT_DECLINE_INFO: DeclineCodeInfo = {
  message:
    'Your payment could not be processed. Please try again or use a different method.',
  retryable: true,
};

/**
 * Map a Stripe decline code to a user-friendly message and retryability flag.
 * Returns default fallback for unknown codes.
 */
export function mapStripeDeclineCode(code?: string | null): DeclineCodeInfo {
  if (!code) return DEFAULT_DECLINE_INFO;
  return DECLINE_CODE_MAP[code] ?? DEFAULT_DECLINE_INFO;
}

/**
 * Check if a decline code indicates a retryable failure.
 */
export function isRetryableDeclineCode(code?: string | null): boolean {
  return mapStripeDeclineCode(code).retryable;
}
