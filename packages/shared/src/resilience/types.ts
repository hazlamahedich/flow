export interface CircuitBreakerPort {
  canExecute(name: string): boolean;
  recordSuccess(name: string): void;
  recordFailure(name: string): void;
  getState(name: string): 'closed' | 'open' | 'half-open';
}

export const NOOP_CIRCUIT_BREAKER: CircuitBreakerPort = {
  canExecute: () => true,
  recordSuccess: () => {},
  recordFailure: () => {},
  getState: () => 'closed',
};
