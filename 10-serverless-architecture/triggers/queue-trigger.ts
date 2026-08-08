import type { Channel, ConsumeMessage } from 'amqplib';
import { ExecutionEnvironmentManager } from '../runtime/execution-environment-manager';
import { PAYMENT_QUEUE } from '../runtime/rabbitmq';

const FUNCTION_NAME = 'processPaymentQueueMessage';

/**
 * Queue trigger, standing in for an SQS -> Lambda event source mapping: for each message
 * delivered on `payment-queue`, invoke `processPaymentQueueMessage` through the SAME
 * execution-environment manager the HTTP and schedule triggers use.
 *
 * Messages are NOT awaited one-at-a-time — each delivery is handled as soon as it arrives
 * (fire-and-forget, acked when its own invocation finishes) with `prefetch` messages allowed
 * in flight simultaneously. That's what makes a burst of messages produce genuine concurrent
 * invocations: the execution-environment manager sees N calls with nothing idle yet and spins up
 * N separate instances, the same way Lambda scales out concurrent execution environments to
 * drain an SQS backlog.
 */
export async function startQueueTrigger(
  manager: ExecutionEnvironmentManager,
  channel: Channel,
  prefetch = 25,
): Promise<void> {
  await channel.prefetch(prefetch);

  let inFlight = 0;
  let burstPeak = 0;
  let coldStartsAtBurstStart = 0;

  await channel.consume(PAYMENT_QUEUE, (msg: ConsumeMessage | null) => {
    if (!msg) {
      return;
    }

    if (inFlight === 0) {
      // A new burst is starting — snapshot cold-start count so we can report the delta.
      burstPeak = 0;
      coldStartsAtBurstStart = manager.getStats()[FUNCTION_NAME]?.coldStarts ?? 0;
    }
    inFlight += 1;
    burstPeak = Math.max(burstPeak, inFlight);

    void handleMessage(manager, channel, msg)
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('[queue-trigger] failed to process message, nacking (no requeue)', err);
        channel.nack(msg, false, false);
      })
      .finally(() => {
        inFlight -= 1;
        if (inFlight === 0) {
          const coldStartsNow = manager.getStats()[FUNCTION_NAME]?.coldStarts ?? 0;
          // eslint-disable-next-line no-console
          console.log(
            `[queue-trigger] burst complete — peak concurrency=${burstPeak}, cold starts this burst=${coldStartsNow - coldStartsAtBurstStart}`,
          );
        }
      });
  });

  // eslint-disable-next-line no-console
  console.log(`[queue-trigger] consuming "${PAYMENT_QUEUE}" with prefetch=${prefetch}`);
}

async function handleMessage(
  manager: ExecutionEnvironmentManager,
  channel: Channel,
  msg: ConsumeMessage,
): Promise<void> {
  const event = JSON.parse(msg.content.toString());
  const result = await manager.invoke(FUNCTION_NAME, event);
  channel.ack(msg);
  // eslint-disable-next-line no-console
  console.log(`[queue-trigger] message acked — cold=${result.cold} billed=${result.billedMs}ms`);
}
