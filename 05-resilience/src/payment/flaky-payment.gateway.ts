import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface PaymentResult {
  provider: 'paystack' | 'flutterwave' | 'cached-fallback';
  reference: string;
  status: 'success' | 'queued';
}

@Injectable()
export class FlakyPaymentGateway {
  private attemptCounter = 0;

  constructor(private readonly config: ConfigService) {}

  async chargePaystack(amount: number): Promise<PaymentResult> {
    this.attemptCounter += 1;
    const failureRate = this.config.get<number>('PAYMENT_FAILURE_RATE', 0.7);

    if (Math.random() < failureRate) {
      throw new Error('Paystack timeout');
    }

    return {
      provider: 'paystack',
      reference: `paystack-${this.attemptCounter}-${amount}`,
      status: 'success',
    };
  }

  async chargeFlutterwave(amount: number): Promise<PaymentResult> {
    return {
      provider: 'flutterwave',
      reference: `flutterwave-${amount}`,
      status: 'success',
    };
  }

  cachedFallback(amount: number): PaymentResult {
    return {
      provider: 'cached-fallback',
      reference: `queued-${amount}`,
      status: 'queued',
    };
  }
}
