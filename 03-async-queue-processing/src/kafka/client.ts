import { Kafka } from 'kafkajs';

/**
 * Plain kafkajs client, deliberately outside Nest's DI container. This comparison piece is
 * meant to be readable as "just Kafka", independent of the RabbitMQ order flow above it.
 */
export function createKafkaClient(clientId: string): Kafka {
  const brokers = (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(',');
  return new Kafka({ clientId, brokers });
}
