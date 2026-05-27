import { describe, it, expect } from 'vitest';
import { mapStripeDeclineCode, isRetryableDeclineCode } from '../stripe-decline-codes';

describe('mapStripeDeclineCode', () => {
  it('maps card_declined', () => {
    const result = mapStripeDeclineCode('card_declined');
    expect(result.message).toBe('The card was declined. Try a different payment method.');
    expect(result.retryable).toBe(false);
  });

  it('maps insufficient_funds', () => {
    const result = mapStripeDeclineCode('insufficient_funds');
    expect(result.message).toBe('The card has insufficient funds.');
    expect(result.retryable).toBe(false);
  });

  it('maps expired_card', () => {
    const result = mapStripeDeclineCode('expired_card');
    expect(result.message).toBe('The card has expired. Please update the card details.');
    expect(result.retryable).toBe(false);
  });

  it('maps incorrect_cvc', () => {
    const result = mapStripeDeclineCode('incorrect_cvc');
    expect(result.message).toBe('The security code is incorrect. Check and try again.');
    expect(result.retryable).toBe(false);
  });

  it('maps processing_error', () => {
    const result = mapStripeDeclineCode('processing_error');
    expect(result.message).toBe('A temporary payment processing error occurred. Please retry.');
    expect(result.retryable).toBe(true);
  });

  it('maps issuer_declined', () => {
    const result = mapStripeDeclineCode('issuer_declined');
    expect(result.message).toBe('The card issuer declined the payment. Please contact your bank.');
    expect(result.retryable).toBe(true);
  });

  it('returns default for unknown code', () => {
    const result = mapStripeDeclineCode('unknown_code_xyz');
    expect(result.message).toBe('Your payment could not be processed. Please try again or use a different method.');
    expect(result.retryable).toBe(true);
  });

  it('returns default for null', () => {
    const result = mapStripeDeclineCode(null);
    expect(result.message).toBe('Your payment could not be processed. Please try again or use a different method.');
    expect(result.retryable).toBe(true);
  });

  it('returns default for undefined', () => {
    const result = mapStripeDeclineCode(undefined);
    expect(result.message).toBe('Your payment could not be processed. Please try again or use a different method.');
    expect(result.retryable).toBe(true);
  });
});

describe('isRetryableDeclineCode', () => {
  it('returns false for non-retryable codes', () => {
    expect(isRetryableDeclineCode('card_declined')).toBe(false);
    expect(isRetryableDeclineCode('expired_card')).toBe(false);
  });

  it('returns true for retryable codes', () => {
    expect(isRetryableDeclineCode('processing_error')).toBe(true);
    expect(isRetryableDeclineCode('issuer_declined')).toBe(true);
  });

  it('returns true for unknown codes', () => {
    expect(isRetryableDeclineCode('foo')).toBe(true);
  });
});
