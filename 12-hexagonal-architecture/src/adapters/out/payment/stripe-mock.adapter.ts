import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ChargeResult, PaymentGatewayPort } from '../../../core/ports/out/payment-gateway.port';

/**
 * Outbound/driven adapter #1 for PaymentGatewayPort — a simulated Stripe. No real network call:
 * a small random latency stands in for the round trip, and a small DETERMINISTIC (not random)
 * failure rate makes the failure mode reproducible in demos and tests instead of flaky.
 * Selected via `PAYMENT_PROVIDER=stripe` (the default).
 */
@Injectable()
export class StripeMockAdapter implements PaymentGatewayPort {
  private callCount = 0;

  async charge(amount: number, customerId: string): Promise<ChargeResult> {
    this.callCount += 1;

    await new Promise((resolve) => setTimeout(resolve, 20 + Math.random() * 60));

    // Every 11th charge on this adapter instance is declined — deterministic, not a dice roll.
    const declined = this.callCount % 11 === 0;
    if (declined) {
      return { success: false, reference: `stripe_declined_${this.callCount}` };
    }

    return {
      success: true,
      reference: `pi_stripe_${randomUUID()}_${customerId}_${amount.toFixed(2)}`,
    };
  }
}
