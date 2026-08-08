/** DI token the core defines and outbound adapters are bound to — see app.module.ts. */
export const PAYMENT_GATEWAY_PORT = Symbol('PAYMENT_GATEWAY_PORT');

export interface ChargeResult {
  success: boolean;
  reference: string;
}

/**
 * Output port: what the core needs from a payment provider. It knows nothing about Stripe or
 * Flutterwave — just this interface. Two adapters implement it (both mocked, no real network
 * calls): StripeMockAdapter and FlutterwaveMockAdapter.
 */
export interface PaymentGatewayPort {
  charge(amount: number, customerId: string): Promise<ChargeResult>;
}
