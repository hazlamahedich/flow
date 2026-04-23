export interface CircuitBreakerState {
  failures: number;
  lastFailureAt: Date | null;
  isOpen: boolean;
}

export class CircuitBreaker {
  private failures = 0;
  private lastFailureAt: Date | null = null;
  private readonly threshold = 5;
  private readonly openDurationMs = 60_000;

  get state(): CircuitBreakerState {
    return {
      failures: this.failures,
      lastFailureAt: this.lastFailureAt,
      isOpen: this.isOpen(),
    };
  }

  private isOpen(): boolean {
    if (this.failures < this.threshold) return false;
    if (!this.lastFailureAt) return false;
    const elapsed = Date.now() - this.lastFailureAt.getTime();
    if (elapsed > this.openDurationMs) return false;
    return true;
  }

  recordSuccess(): void {
    this.failures = 0;
    this.lastFailureAt = null;
  }

  recordFailure(): void {
    this.failures += 1;
    this.lastFailureAt = new Date();
  }
}
