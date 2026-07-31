import type { Channel } from 'amqplib';

/**
 * The full RabbitMQ topology for the Uber-style ride.completed fan-out, including the
 * TTL + dead-letter-exchange retry mechanism. Asserted idempotently by both the API
 * (so publishing never targets a non-existent exchange) and the worker process.
 *
 *   producer                 ride_events (topic exchange)
 *     |  publish                    |  routing key "ride.completed"
 *     v                    +--------+--------+--------+
 *                          v                 v         v
 *                   email.queue     analytics.queue  loyalty.queue
 *                          |                 |         |
 *                    (worker fails)          |         |
 *                          v                 |         |
 *              email.queue.retry             |         |
 *              (x-message-ttl: 30s)          |         |
 *              (x-dead-letter-exchange: ride_events.dlx)
 *                          |
 *                 TTL expires, DLX redelivers
 *                 (routing key = "email.queue")
 *                          v
 *                   email.queue  <---- ride_events.dlx (direct exchange)
 *                          |
 *                 still failing after MAX_DELIVERY_ATTEMPTS
 *                          v
 *              email.queue.dead-letter  (inspected manually)
 */

export const RIDE_EVENTS_EXCHANGE = 'ride_events';
export const RIDE_EVENTS_DLX = 'ride_events.dlx';
export const RIDE_COMPLETED_ROUTING_KEY = 'ride.completed';

export const RETRY_TTL_MS = 30_000;
export const MAX_DELIVERY_ATTEMPTS = 3;
export const RETRY_COUNT_HEADER = 'x-retry-count';

export interface WorkQueueDefinition {
  /** Durable queue a worker actually consumes from. */
  name: string;
  /** Holding queue: messages sit here for RETRY_TTL_MS, then get dead-lettered back to `name`. */
  retryName: string;
  /** Terminal queue for messages that failed MAX_DELIVERY_ATTEMPTS times. Never auto-drained. */
  deadLetterName: string;
}

function defineWorkQueue(name: string): WorkQueueDefinition {
  return { name, retryName: `${name}.retry`, deadLetterName: `${name}.dead-letter` };
}

export const EMAIL_QUEUE = defineWorkQueue('email.queue');
export const ANALYTICS_QUEUE = defineWorkQueue('analytics.queue');
export const LOYALTY_QUEUE = defineWorkQueue('loyalty.queue');

export const ALL_WORK_QUEUES: WorkQueueDefinition[] = [EMAIL_QUEUE, ANALYTICS_QUEUE, LOYALTY_QUEUE];

/**
 * Idempotent topology setup. Safe to call from both the API (as a publisher, so the exchange
 * exists before the first POST /rides) and the worker (as a consumer).
 *
 * Uses only core AMQP 0-9-1 features (a second exchange + per-queue TTL/DLX arguments) rather
 * than the delayed-message-exchange plugin, so it works against any stock RabbitMQ image.
 */
export async function assertTopology(channel: Channel): Promise<void> {
  await channel.assertExchange(RIDE_EVENTS_EXCHANGE, 'topic', { durable: true });
  await channel.assertExchange(RIDE_EVENTS_DLX, 'direct', { durable: true });

  for (const queue of ALL_WORK_QUEUES) {
    await channel.assertQueue(queue.name, { durable: true });
    await channel.bindQueue(queue.name, RIDE_EVENTS_EXCHANGE, RIDE_COMPLETED_ROUTING_KEY);
    // Redelivery path: when a retry-queue message's TTL expires, RabbitMQ republishes it to
    // ride_events.dlx with routing key === queue.name, which is bound straight back to queue.name.
    await channel.bindQueue(queue.name, RIDE_EVENTS_DLX, queue.name);

    await channel.assertQueue(queue.retryName, {
      durable: true,
      arguments: {
        'x-message-ttl': RETRY_TTL_MS,
        'x-dead-letter-exchange': RIDE_EVENTS_DLX,
        'x-dead-letter-routing-key': queue.name,
      },
    });

    await channel.assertQueue(queue.deadLetterName, { durable: true });
  }
}
