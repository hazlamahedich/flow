export type CircuitState = 'closed' | 'open' | 'halfOpen';

export interface CircuitBreakerState {
  state: CircuitState;
  failures: number;
  lastFailureAt: Date | null;
  isOpen: boolean;
}

export class CircuitBreaker {
  private failures = 0;
  private lastFailureAt: Date | null = null;
  private circuitState: CircuitState = 'closed';
  private halfOpenProbe = false;
  private readonly threshold = 5;
  private readonly openDurationMs = 60_000;

  get state(): CircuitBreakerState {
    return {
      state: this.circuitState,
      failures: this.failures,
      lastFailureAt: this.lastFailureAt,
      isOpen: this.isOpen(),
    };
  }

  isOpen(): boolean {
    if (this.circuitState === 'closed') return false;
    if (this.circuitState === 'halfOpen') return false;
    if (!this.lastFailureAt) return false;
    const elapsed = Date.now() - this.lastFailureAt.getTime();
    if (elapsed > this.openDurationMs) {
      this.circuitState = 'halfOpen';
      this.halfOpenProbe = false;
      return false;
    }
    return true;
  }

  recordSuccess(): void {
    this.failures = 0;
    this.lastFailureAt = null;
    this.circuitState = 'closed';
    this.halfOpenProbe = false;
  }

  recordFailure(): void {
    this.failures += 1;
    this.lastFailureAt = new Date();
    if (this.circuitState === 'halfOpen') {
      this.circuitState = 'open';
      this.halfOpenProbe = false;
    } else if (this.failures >= this.threshold) {
      this.circuitState = 'open';
    }
  }

  allowRequest(): boolean {
    if (this.circuitState === 'closed') return true;
    if (this.circuitState === 'open') {
      if (!this.lastFailureAt) return false;
      const elapsed = Date.now() - this.lastFailureAt.getTime();
      if (elapsed > this.openDurationMs) {
        this.circuitState = 'halfOpen';
        this.halfOpenProbe = false;
        return true;
      }
      return false;
    }
    if (this.circuitState === 'halfOpen') {
      if (!this.halfOpenProbe) {
        this.halfOpenProbe = true;
        return true;
      }
      return false;
    }
    return false;
  }
}
