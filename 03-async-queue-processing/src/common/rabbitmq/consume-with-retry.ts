import { Logger } from '@nestjs/common';
import type { Channel, ConsumeMessage } from 'amqplib';
import { RabbitmqService } from './rabbitmq.service';
import {
  MAX_DELIVERY_ATTEMPTS,
  RETRY_COUNT_HEADER,
  RETRY_TTL_MS,
  WorkQueueDefinition,
} from './topology';
import { nextAttempt, shouldDeadLetter } from './retry.util';

/**
 * Wires a queue up to a handler with the retry/DLQ decision baked in:
 *  - handler succeeds  -> ack.
 *  - handler throws, attempts remaining -> republish to `${queue}.retry` (TTL redelivers it to
 *    the main queue after RETRY_TTL_MS) and ack the original delivery.
 *  - handler throws, attempts exhausted -> republish to `${queue}.dead-letter` and ack.
 * We always ack the original message ourselves (never nack-requeue) because the redelivery is
 * done explicitly via the retry queue — leaving the message on the main queue would just spin
 * it back to the front of the same queue with no delay and no attempt cap.
 */
export async function consumeWithRetry<T>(
  rabbitmq: RabbitmqService,
  queue: WorkQueueDefinition,
  handler: (payload: T) => Promise<void>,
  logger: Logger,
): Promise<void> {
  await rabbitmq.consume(queue.name, 10, async (channel: Channel, msg: ConsumeMessage) => {
    const headers = msg.properties.headers ?? {};

    try {
      const payload = JSON.parse(msg.content.toString('utf8')) as T;
      await handler(payload);
      channel.ack(msg);
      return;
    } catch (error) {
      const attempt = nextAttempt(headers);
      const reason = error instanceof Error ? error.message : String(error);
      const nextHeaders = { ...headers, [RETRY_COUNT_HEADER]: attempt, 'x-last-error': reason };

      if (shouldDeadLetter(attempt, MAX_DELIVERY_ATTEMPTS)) {
        logger.error(
          `${queue.name}: attempt ${attempt}/${MAX_DELIVERY_ATTEMPTS} failed (${reason}) — routing to ${queue.deadLetterName}`,
        );
        await rabbitmq.sendToQueue(queue.deadLetterName, msg.content, nextHeaders);
      } else {
        logger.warn(
          `${queue.name}: attempt ${attempt}/${MAX_DELIVERY_ATTEMPTS} failed (${reason}) — retrying via ${queue.retryName} in ${RETRY_TTL_MS}ms`,
        );
        await rabbitmq.sendToQueue(queue.retryName, msg.content, nextHeaders);
      }

      channel.ack(msg);
    }
  });
}
