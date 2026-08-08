import 'dotenv/config';
import * as path from 'path';
import type { Channel } from 'amqplib';
import express from 'express';
import { ExecutionEnvironmentManager } from './runtime/execution-environment-manager';
import { connectRabbitMQ, PAYMENT_QUEUE } from './runtime/rabbitmq';
import { createApiGatewayRouter } from './triggers/api-gateway';
import { createFileDropRouter } from './triggers/file-drop-trigger';
import { startScheduleTrigger } from './triggers/schedule-trigger';
import { startQueueTrigger } from './triggers/queue-trigger';

const PORT = Number(process.env.PORT ?? 3010);
const WARM_TTL_MS = Number(process.env.WARM_TTL_MS ?? 60_000);
const COLD_START_LATENCY_MS = Number(process.env.COLD_START_LATENCY_MS ?? 400);
const SCHEDULE_INTERVAL_MS = Number(process.env.SCHEDULE_INTERVAL_MS ?? 30_000);
const RABBITMQ_URL =
  process.env.RABBITMQ_URL ?? 'amqp://serverless_demo:serverless_demo_password@localhost:5673';

async function bootstrap(): Promise<void> {
  const manager = new ExecutionEnvironmentManager({
    warmTtlMs: WARM_TTL_MS,
    coldStartLatencyMs: COLD_START_LATENCY_MS,
    sweepIntervalMs: 5_000,
  });

  // Register every function against its compiled module path (no extension — resolves to .js
  // under dist/, or .ts under ts-node in dev). This registry is the only place that knows where
  // function code lives; the manager itself is generic.
  manager.register('createOrder', path.join(__dirname, 'functions', 'createOrder'));
  manager.register('resizeProductImage', path.join(__dirname, 'functions', 'resizeProductImage'));
  manager.register('dailySalesReport', path.join(__dirname, 'functions', 'dailySalesReport'));
  manager.register(
    'processPaymentQueueMessage',
    path.join(__dirname, 'functions', 'processPaymentQueueMessage'),
  );

  manager.startSweeper();

  const app = express();
  app.use(express.json());

  // Triggers: different front doors, same execution-environment manager underneath.
  app.use(createApiGatewayRouter(manager));
  app.use(createFileDropRouter(manager));

  app.get('/_runtime/stats', (_req, res) => {
    res.json(manager.getStats());
  });

  app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Demo tooling: publishes a burst of fake payment messages so the queue-trigger concurrency
  // demo doesn't require a separate script. Not itself a trigger — it just feeds the real one.
  let paymentChannel: Channel | null = null;
  app.post('/_simulate/payment-burst', (req, res) => {
    if (!paymentChannel) {
      res.status(503).json({ error: 'RabbitMQ not connected yet — try again shortly' });
      return;
    }

    const count = Number(req.body?.count ?? 10);
    for (let i = 0; i < count; i++) {
      const message = {
        messageId: `msg-${Date.now()}-${i}`,
        orderId: `order-${i}`,
        amount: Math.round(Math.random() * 10_000),
      };
      paymentChannel.sendToQueue(PAYMENT_QUEUE, Buffer.from(JSON.stringify(message)), {
        persistent: true,
      });
    }

    res.json({ published: count, queue: PAYMENT_QUEUE });
  });

  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`[serverless-emulator] apiGateway listening on port ${PORT}`);
  });

  startScheduleTrigger(manager, SCHEDULE_INTERVAL_MS);

  connectRabbitMQ(RABBITMQ_URL)
    .then(async (channel) => {
      paymentChannel = channel;
      await startQueueTrigger(manager, channel);
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error(
        '[serverless-emulator] RabbitMQ unavailable — queue trigger disabled, everything else still works',
        err,
      );
    });
}

bootstrap();
