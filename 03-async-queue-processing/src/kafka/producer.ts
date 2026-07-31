import { randomUUID } from 'crypto';
import { createKafkaClient } from './client';
import { ORDER_EVENTS_TOPIC } from './constants';

/**
 * Standalone script (not part of the Nest app): publishes order.created events to Kafka so
 * multiple independent consumer groups can each read the full stream. Contrast with
 * RabbitMQ's ride.completed above, where a job goes to exactly one worker.
 */
async function main() {
  const kafka = createKafkaClient('order-events-producer');
  const producer = kafka.producer();
  await producer.connect();

  const count = Number(process.env.EVENT_COUNT ?? 10);
  const intervalMs = Number(process.env.EVENT_INTERVAL_MS ?? 1000);

  console.log(
    `[kafka-producer] publishing ${count} order.created events to "${ORDER_EVENTS_TOPIC}"`,
  );

  for (let i = 0; i < count; i++) {
    const orderId = randomUUID();
    const event = {
      type: 'order.created',
      orderId,
      customerId: `customer-${Math.ceil(Math.random() * 1000)}`,
      total: Number((Math.random() * 200 + 10).toFixed(2)),
      createdAt: new Date().toISOString(),
    };

    await producer.send({
      topic: ORDER_EVENTS_TOPIC,
      messages: [{ key: orderId, value: JSON.stringify(event) }],
    });
    console.log(`[kafka-producer] published order.created orderId=${orderId}`);

    if (i < count - 1) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  await producer.disconnect();
  console.log('[kafka-producer] done');
}

main().catch((err) => {
  console.error('[kafka-producer] fatal error', err);
  process.exit(1);
});
