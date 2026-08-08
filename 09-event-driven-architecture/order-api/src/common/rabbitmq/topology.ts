import type { Channel } from 'amqplib';

/**
 * order-api is a publisher and nothing else. It asserts that the `grocery_events` exchange
 * exists (so the very first POST /orders doesn't fail against a missing exchange) and then
 * publishes to it. It does NOT assert, bind, or even know the names of any queue — that is
 * entirely each consumer's business. Compare with `03-async-queue-processing`'s topology.ts,
 * where the producer's topology file also declares the work queues the producer expects to
 * exist: that only makes sense there because RabbitMQ is being used for point-to-point task
 * queueing (the producer cares that "the email queue" exists). Here it's pub/sub — order-api
 * fires `order.placed` into the exchange and walks away.
 */
export const GROCERY_EVENTS_EXCHANGE = 'grocery_events';
export const ORDER_PLACED_ROUTING_KEY = 'order.placed';

export async function assertTopology(channel: Channel): Promise<void> {
  await channel.assertExchange(GROCERY_EVENTS_EXCHANGE, 'topic', { durable: true });
}
