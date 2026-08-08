import * as amqp from 'amqplib';

export const PAYMENT_QUEUE = 'payment-queue';

/**
 * Connects to RabbitMQ with retries, since the broker container may still be starting when this
 * process boots. Returns a ready-to-use channel with the payment queue asserted.
 */
export async function connectRabbitMQ(
  url: string,
  attempts = 20,
  delayMs = 2_000,
): Promise<amqp.Channel> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const connection = await amqp.connect(url);
      connection.on('close', () => {
        // eslint-disable-next-line no-console
        console.warn('[rabbitmq] connection closed');
      });
      connection.on('error', (err) => {
        // eslint-disable-next-line no-console
        console.error('[rabbitmq] connection error', err);
      });

      const channel = await connection.createChannel();
      await channel.assertQueue(PAYMENT_QUEUE, { durable: true });
      // eslint-disable-next-line no-console
      console.log(`[rabbitmq] connected, queue "${PAYMENT_QUEUE}" ready`);
      return channel;
    } catch (err) {
      lastError = err;
      // eslint-disable-next-line no-console
      console.warn(
        `[rabbitmq] connection attempt ${attempt}/${attempts} failed (${(err as Error).message}), retrying in ${delayMs}ms`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Could not connect to RabbitMQ');
}
