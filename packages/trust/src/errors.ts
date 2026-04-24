export type TrustTransitionErrorCode =
  | 'CONCURRENT_MODIFICATION'
  | 'INVALID_TRANSITION'
  | 'PRECONDITION_FAILED'
  | 'QUERY_FAILED';

export class TrustTransitionError extends Error {
  public readonly code: TrustTransitionErrorCode;
  public readonly retryable: boolean;
  public readonly details: Record<string, unknown> | undefined;

  constructor(
    code: TrustTransitionErrorCode,
    message: string,
    options?: { retryable?: boolean; details?: Record<string, unknown> },
  ) {
    super(message);
    this.name = 'TrustTransitionError';
    this.code = code;
    this.retryable = options?.retryable ?? (code === 'QUERY_FAILED');
    if (options?.details !== undefined) {
      this.details = options.details;
    }
  }
}
