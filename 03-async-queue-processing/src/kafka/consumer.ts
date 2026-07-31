import { createKafkaClient } from './client';
import { ORDER_EVENTS_TOPIC } from './constants';

/**
 * Standalone consumer, parameterized by GROUP_ID (see npm run kafka:consume:*). Run two or
 * three of these against the same topic and each one logs every event independently —
 * consumer groups each track their own committed offset, unlike a RabbitMQ queue where a
 * message is removed once one worker consumes it.
 */
async function main() {
  const groupId = process.env.GROUP_ID;
  if (!groupId) {
    throw new Error('GROUP_ID env var is required, e.g. GROUP_ID=inventory-group');
  }
  const label = process.env.CONSUMER_LABEL ?? groupId;

  const kafka = createKafkaClient(`order-events-consumer-${groupId}`);
  const consumer = kafka.consumer({ groupId });
  await consumer.connect();
  await consumer.subscribe({ topic: ORDER_EVENTS_TOPIC, fromBeginning: true });

  console.log(`[${label}] subscribed to "${ORDER_EVENTS_TOPIC}" as consumer group "${groupId}"`);

  await consumer.run({
    eachMessage: async ({ partition, message }) => {
      const event = JSON.parse(message.value?.toString('utf8') ?? '{}');
      console.log(
        `[${label}] received ${event.type} orderId=${event.orderId} partition=${partition} offset=${message.offset} — processed independently of the other consumer groups`,
      );
    },
  });
}

main().catch((err) => {
  console.error('[kafka-consumer] fatal error', err);
  process.exit(1);
});
