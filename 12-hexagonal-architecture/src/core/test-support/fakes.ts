import { NotifierPort } from '../ports/out/notifier.port';
import { ChargeResult, PaymentGatewayPort } from '../ports/out/payment-gateway.port';

/**
 * Trivial in-memory test doubles for the core's OUTPUT ports. Zero framework imports, zero I/O —
 * this is what makes it possible to unit test the core's business rules without a database,
 * without NestJS, and without HTTP. See src/core/application/*.spec.ts.
 */

export class AlwaysSucceedsPaymentGateway implements PaymentGatewayPort {
  readonly charges: Array<{ amount: number; customerId: string }> = [];

  async charge(amount: number, customerId: string): Promise<ChargeResult> {
    this.charges.push({ amount, customerId });
    return { success: true, reference: `fake_ref_${this.charges.length}` };
  }
}

export class AlwaysFailsPaymentGateway implements PaymentGatewayPort {
  readonly charges: Array<{ amount: number; customerId: string }> = [];

  async charge(amount: number, customerId: string): Promise<ChargeResult> {
    this.charges.push({ amount, customerId });
    return { success: false, reference: 'fake_declined' };
  }
}

export class RecordingNotifier implements NotifierPort {
  readonly messages: Array<{ customerId: string; message: string }> = [];

  async notify(customerId: string, message: string): Promise<void> {
    this.messages.push({ customerId, message });
  }
}
