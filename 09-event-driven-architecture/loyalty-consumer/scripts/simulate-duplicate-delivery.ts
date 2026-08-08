/**
 * Simulates a duplicate delivery of a single order.placed event straight onto
 * loyalty-consumer's own queue — the same thing a real RabbitMQ redelivery would do if
 * loyalty-consumer crashed after applying an event but before acking it, or if the broker
 * decided a message needed redelivering after a network blip.
 *
 * Deliberately sends to `loyalty.order-placed.queue` directly (via `sendToQueue`), NOT to the
 * `grocery_events` exchange. Publishing to the exchange would fan the duplicate out to
 * inventory-consumer/notification-consumer/analytics-consumer too, and this demo is about
 * proving loyalty-consumer's idempotency check specifically — those three consumers don't
 * implement one (see README), so a shared/exchange-wide duplicate would double their side
 * effects and muddy the result. Publishing directly to one already-bound queue is exactly what a
 * redelivery to that queue alone looks like on the wire.
 *
 * Usage (from this directory, after `npm install`):
 *   npm run simulate:duplicate
 *
 * Then: curl http://localhost:4104/points — the demo customer's points reflect ONE award, plus
 * one entry in processedEventCount, not two, even though the message was delivered twice.
 */
import * as amqplib from 'amqplib';

const RABBITMQ_URL = process.env.RABBITMQ_URL ?? 'amqp://freshcart:freshcart_password@localhost:5672';
const GROCERY_EVENTS_EXCHANGE = 'grocery_events';
const ORDER_PLACED_ROUTING_KEY = 'order.placed';
const LOYALTY_QUEUE = 'loyalty.order-placed.queue';
const DEMO_CUSTOMER_ID = 'demo-customer-idempotency';

async function main() {
  const connection = await amqplib.connect(RABBITMQ_URL);
  const channel = await connection.createChannel();

  // Idempotent — matches the topology loyalty-consumer itself asserts on boot.
  await channel.assertExchange(GROCERY_EVENTS_EXCHANGE, 'topic', { durable: true });
  await channel.assertQueue(LOYALTY_QUEUE, { durable: true });
  await channel.bindQueue(LOYALTY_QUEUE, GROCERY_EVENTS_EXCHANGE, ORDER_PLACED_ROUTING_KEY);

  const eventId = randomUUID();
  const event = {
    eventId,
    eventType: 'order.placed',
    occurredAt: new Date().toISOString(),
    payload: {
      orderId: randomUUID(),
      customerId: DEMO_CUSTOMER_ID,
      items: [{ sku: 'rice-5kg', name: 'Rice 5kg Bag', quantity: 1, unitPrice: 42 }],
      totalAmount: 42,
    },
  };
  const content = Buffer.from(JSON.stringify(event));

  console.log(`Simulating a duplicate delivery of eventId=${eventId} to ${LOYALTY_QUEUE}`);
  console.log(`Expect: exactly one award of ${Math.round(event.payload.totalAmount)} points to ${DEMO_CUSTOMER_ID}\n`);

  console.log('Sending delivery #1...');
  channel.sendToQueue(LOYALTY_QUEUE, content, { persistent: true, contentType: 'application/json' });

  await sleep(500);

  console.log('Sending delivery #2 (identical eventId — simulates redelivery)...');
  channel.sendToQueue(LOYALTY_QUEUE, content, { persistent: true, contentType: 'application/json' });

  await sleep(500);

  console.log(
    `\nDone. Check: curl http://localhost:${process.env.LOYALTY_CONSUMER_PORT ?? 4104}/points`,
  );
  console.log(
    `${DEMO_CUSTOMER_ID} should show ${Math.round(event.payload.totalAmount)} points (not ` +
      `${Math.round(event.payload.totalAmount) * 2}), and processedEventCount should have ` +
      'increased by exactly 1, not 2.',
  );

  await channel.close();
  await connection.close();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomUUID(): string {
  return require('node:crypto').randomUUID();
}

main().catch((err) => {
  console.error('simulate-duplicate-delivery failed:', err);
  process.exit(1);
});
