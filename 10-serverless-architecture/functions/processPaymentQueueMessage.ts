import { FunctionContext, FunctionResponse } from '../runtime/types';

/**
 * Queue-triggered function: one invocation per RabbitMQ message on `payment-queue`, standing in
 * for SQS -> Lambda event source mapping. When several messages arrive in a burst, the queue
 * trigger adapter invokes this function concurrently (not one-at-a-time), which is what lets the
 * execution-environment manager demonstrate automatic concurrency scaling.
 */
// eslint-disable-next-line no-console
console.log('[processPaymentQueueMessage] cold init: payment processor handler module loaded');

interface PaymentMessageEvent {
  messageId: string;
  orderId: string;
  amount: number;
}

export async function handler(
  event: PaymentMessageEvent,
  context: FunctionContext,
): Promise<FunctionResponse> {
  // Simulated payment-processing work (charge validation, ledger write, etc.).
  await sleep(80 + Math.random() * 120);

  // eslint-disable-next-line no-console
  console.log(
    `[processPaymentQueueMessage] processed messageId=${event.messageId} orderId=${event.orderId} amount=${event.amount} instance=${context.requestId}`,
  );

  return {
    statusCode: 200,
    body: JSON.stringify({ processed: true, messageId: event.messageId }),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
