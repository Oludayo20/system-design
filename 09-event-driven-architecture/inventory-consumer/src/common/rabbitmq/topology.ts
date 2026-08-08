import type { Channel } from 'amqplib';

/**
 * inventory-consumer asserts the exchange too (idempotent — safe even if order-api hasn't
 * started yet) plus its OWN queue, bound to `order.placed`. This queue belongs to
 * inventory-consumer alone: notification-consumer, analytics-consumer, and loyalty-consumer each
 * bind their own separate queue to the same exchange/routing key, so all four receive an
 * independent copy of every order.placed event — true fan-out (pub/sub), not four workers
 * competing for one shared queue's messages the way `email.queue` works in
 * `03-async-queue-processing`.
 */
export const GROCERY_EVENTS_EXCHANGE = 'grocery_events';
export const ORDER_PLACED_ROUTING_KEY = 'order.placed';
export const INVENTORY_QUEUE = 'inventory.order-placed.queue';

export async function assertTopology(channel: Channel): Promise<void> {
  await channel.assertExchange(GROCERY_EVENTS_EXCHANGE, 'topic', { durable: true });
  await channel.assertQueue(INVENTORY_QUEUE, { durable: true });
  await channel.bindQueue(INVENTORY_QUEUE, GROCERY_EVENTS_EXCHANGE, ORDER_PLACED_ROUTING_KEY);
}
