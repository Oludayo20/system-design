import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CircuitBreaker } from '../resilience/circuit-breaker';
import { withRetries } from '../resilience/retry.util';
import { FlakyPaymentGateway, PaymentResult } from './flaky-payment.gateway';

@Injectable()
export class CheckoutService {
  private readonly paystackBreaker: CircuitBreaker;

  constructor(
    private readonly payments: FlakyPaymentGateway,
    private readonly config: ConfigService,
  ) {
    this.paystackBreaker = new CircuitBreaker({
      failureThreshold: this.config.get<number>('CIRCUIT_FAILURE_THRESHOLD', 5),
      resetTimeoutMs: this.config.get<number>('CIRCUIT_RESET_MS', 10_000),
    });
  }

  async checkout(amount: number): Promise<PaymentResult> {
    const maxRetries = this.config.get<number>('MAX_RETRIES', 3);
    const retryDelayMs = this.config.get<number>('RETRY_DELAY_MS', 200);

    try {
      return await this.paystackBreaker.execute(() =>
        withRetries(() => this.payments.chargePaystack(amount), {
          maxAttempts: maxRetries,
          delayMs: retryDelayMs,
        }),
      );
    } catch {
      try {
        return await this.payments.chargeFlutterwave(amount);
      } catch {
        return this.payments.cachedFallback(amount);
      }
    }
  }

  getCircuitState(): string {
    return this.paystackBreaker.getState();
  }
}
