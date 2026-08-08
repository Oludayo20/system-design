import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ChargeResult, PaymentGatewayPort } from '../../../core/ports/out/payment-gateway.port';

/**
 * Outbound/driven adapter #2 for PaymentGatewayPort — a simulated Flutterwave. Implements the
 * exact same port as StripeMockAdapter with different latency/failure characteristics, proving
 * providers are swappable without the core (or the use cases) knowing or caring which one runs.
 * Selected via `PAYMENT_PROVIDER=flutterwave`.
 */
@Injectable()
export class FlutterwaveMockAdapter implements PaymentGatewayPort {
  private callCount = 0;

  async charge(amount: number, customerId: string): Promise<ChargeResult> {
    this.callCount += 1;

    await new Promise((resolve) => setTimeout(resolve, 15 + Math.random() * 50));

    // Every 13th charge on this adapter instance is declined — a different deterministic cadence
    // than Stripe's, just to make the two adapters observably distinct in a demo.
    const declined = this.callCount % 13 === 0;
    if (declined) {
      return { success: false, reference: `flw_declined_${this.callCount}` };
    }

    return {
      success: true,
      reference: `flw_${randomUUID()}_${customerId}_${amount.toFixed(2)}`,
    };
  }
}
