import type { Channel } from 'amqplib';

/**
 * This is the "day 2" consumer. It binds a brand-new queue to the exact same exchange and
 * routing key order-api has been publishing to since day 1 — `assertExchange` here is safe
 * even though order-api already created it; asserting the same exchange twice with the same
 * arguments is a no-op. Nothing about order-api's code, its Dockerfile, or its deployment
 * changed to make this consumer possible. That is the whole point of pub/sub over a broker:
 * loyalty-consumer opted in by binding a queue, order-api never opted anyone in.
 */
export const GROCERY_EVENTS_EXCHANGE = 'grocery_events';
export const ORDER_PLACED_ROUTING_KEY = 'order.placed';
export const LOYALTY_QUEUE = 'loyalty.order-placed.queue';

export async function assertTopology(channel: Channel): Promise<void> {
  await channel.assertExchange(GROCERY_EVENTS_EXCHANGE, 'topic', { durable: true });
  await channel.assertQueue(LOYALTY_QUEUE, { durable: true });
  await channel.bindQueue(LOYALTY_QUEUE, GROCERY_EVENTS_EXCHANGE, ORDER_PLACED_ROUTING_KEY);
}
