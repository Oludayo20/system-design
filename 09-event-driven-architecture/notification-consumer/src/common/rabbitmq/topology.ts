import type { Channel } from 'amqplib';

/**
 * Own exchange assertion (idempotent) + own queue, bound to the same `order.placed` routing key
 * that inventory-consumer, analytics-consumer, and loyalty-consumer bind to. Four separate
 * queues on one exchange is what makes this fan-out instead of task distribution: every queue
 * gets its own full copy of each event.
 */
export const GROCERY_EVENTS_EXCHANGE = 'grocery_events';
export const ORDER_PLACED_ROUTING_KEY = 'order.placed';
export const NOTIFICATION_QUEUE = 'notification.order-placed.queue';

export async function assertTopology(channel: Channel): Promise<void> {
  await channel.assertExchange(GROCERY_EVENTS_EXCHANGE, 'topic', { durable: true });
  await channel.assertQueue(NOTIFICATION_QUEUE, { durable: true });
  await channel.bindQueue(NOTIFICATION_QUEUE, GROCERY_EVENTS_EXCHANGE, ORDER_PLACED_ROUTING_KEY);
}
