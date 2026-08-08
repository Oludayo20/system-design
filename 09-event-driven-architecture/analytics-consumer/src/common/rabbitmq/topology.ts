import type { Channel } from 'amqplib';

export const GROCERY_EVENTS_EXCHANGE = 'grocery_events';
export const ORDER_PLACED_ROUTING_KEY = 'order.placed';
export const ANALYTICS_QUEUE = 'analytics.order-placed.queue';

export async function assertTopology(channel: Channel): Promise<void> {
  await channel.assertExchange(GROCERY_EVENTS_EXCHANGE, 'topic', { durable: true });
  await channel.assertQueue(ANALYTICS_QUEUE, { durable: true });
  await channel.bindQueue(ANALYTICS_QUEUE, GROCERY_EVENTS_EXCHANGE, ORDER_PLACED_ROUTING_KEY);
}
