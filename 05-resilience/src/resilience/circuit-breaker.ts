export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeoutMs: number;
}

/**
 * Minimal circuit breaker: after N consecutive failures, short-circuit calls
 * until the reset window passes, then allow a single probe (HALF_OPEN).
 */
export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private consecutiveFailures = 0;
  private openedAt: number | null = null;

  constructor(private readonly options: CircuitBreakerOptions) {}

  getState(): CircuitState {
    this.refreshState();
    return this.state;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.refreshState();

    if (this.state === 'OPEN') {
      throw new Error('Circuit breaker is OPEN');
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private refreshState(): void {
    if (this.state !== 'OPEN' || this.openedAt === null) {
      return;
    }

    if (Date.now() - this.openedAt >= this.options.resetTimeoutMs) {
      this.state = 'HALF_OPEN';
    }
  }

  private onSuccess(): void {
    this.consecutiveFailures = 0;
    this.openedAt = null;
    this.state = 'CLOSED';
  }

  private onFailure(): void {
    this.consecutiveFailures += 1;

    if (this.consecutiveFailures >= this.options.failureThreshold) {
      this.state = 'OPEN';
      this.openedAt = Date.now();
    }
  }
}
