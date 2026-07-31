import { bootstrap } from '../src/bootstrap.js';
import { createServer } from '../src/api/server.js';
import { delay } from '../src/infrastructure/delay.js';
import { Queue } from '../src/infrastructure/eventBus.js';
import { ShardRouter } from '../src/infrastructure/sharding.js';

const PORT = 4500;
const BASE = `http://localhost:${PORT}`;

function heading(title) {
  console.log(`\n${'='.repeat(70)}\n${title}\n${'='.repeat(70)}`);
}

function step(title) {
  console.log(`\n--- ${title} ---`);
}

async function actOneModularMonolith() {
  heading('ACT 1 - Modular Monolith + Async Processing + Caching (doc.md)');
  console.log(
    'One repository, one deployment, one process - but internally split into\n' +
      'Identity / Catalog / Basket / Ordering modules that talk through events,\n' +
      'not direct function calls into each other\'s internals.'
  );

  const services = await bootstrap();
  const expressApp = createServer(services);
  const httpServer = await new Promise((resolve) => {
    const s = expressApp.listen(PORT, () => resolve(s));
  });

  step('Identity module: register + login');
  await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'ada@example.com', password: 'secret123' }),
  });
  const loginRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'ada@example.com', password: 'secret123' }),
  });
  const { token } = await loginRes.json();
  console.log(`[Client] received token: ${token}`);

  step('Catalog module + Redis-style cache');
  console.log('[Client] GET /products/1 (first time - expect a cache MISS)');
  await fetch(`${BASE}/products/1`);
  console.log('[Client] GET /products/1 (again - expect a cache HIT)');
  await fetch(`${BASE}/products/1`);

  step('Basket module');
  await fetch(`${BASE}/basket/1/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId: 1, qty: 1 }),
  });

  step('Ordering module: place order (this is the doc.md "async" payoff)');
  const requestStart = Date.now();
  const orderRes = await fetch(`${BASE}/orders/1`, { method: 'POST' });
  const orderBody = await orderRes.json();
  console.log(
    `[Client] response received after ${Date.now() - requestStart}ms: ${JSON.stringify(orderBody.order.status)} order #${orderBody.order.id}, total $${orderBody.order.total}`
  );
  console.log('[Client] the customer\'s screen can now show "Order placed!" ...');
  console.log('          ...meanwhile inventory/notification/analytics/fraud-detection are still working:');

  // Give the background workers time to finish so their log lines print
  // before we move on - in a real system the process would just keep running.
  await delay(1200);

  httpServer.close();
  return services;
}

async function actTwoTrafficSpikeAndRetries() {
  heading('ACT 2 - Traffic Spikes & Retrying Failed Jobs (doc.md)');
  console.log('doc.md: "Without a queue: your server crashes. With RabbitMQ: jobs are');
  console.log('gradually processed by a small pool of workers."');

  const spikeQueue = new Queue('flash-sale-emails');
  let processed = 0;
  const TOTAL_JOBS = 30;
  const WORKER_COUNT = 4;

  for (let i = 0; i < WORKER_COUNT; i++) {
    spikeQueue.registerWorker(`email-worker-${i + 1}`, async () => {
      await delay(120);
      processed += 1;
    });
  }

  step(`Producer publishes ${TOTAL_JOBS} email jobs almost instantly (flash sale)`);
  for (let i = 1; i <= TOTAL_JOBS; i++) {
    spikeQueue.publish({ type: 'SEND_EMAIL', to: `user${i}@example.com` });
  }

  while (!spikeQueue.isIdle() || processed < TOTAL_JOBS) {
    await delay(150);
    console.log(`  ... ${processed}/${TOTAL_JOBS} emails sent so far (${WORKER_COUNT} workers, queue length ${spikeQueue.jobs.length})`);
  }
  console.log(`[Result] all ${TOTAL_JOBS} jobs processed without the API ever blocking on a single request.`);
  spikeQueue.stop();

  step('Retry + Dead Letter Queue');
  const flakyQueue = new Queue('flaky-sms');
  let attempts = 0;
  flakyQueue.registerWorker('sms-worker', async (payload) => {
    attempts += 1;
    if (payload.willFailForever) {
      throw new Error('SMS provider permanently rejecting this number');
    }
    if (attempts < 2) {
      throw new Error('SMS provider temporarily unavailable');
    }
    console.log(`  [SMS Worker] delivered SMS to ${payload.to}`);
  }, { maxRetries: 2, retryDelayMs: 250 });

  flakyQueue.publish({ to: '+234-000-0000' }); // will fail once, then succeed
  flakyQueue.publish({ to: '+234-111-1111', willFailForever: true }); // ends up in the DLQ

  await delay(2000);
  console.log(`[Result] Dead Letter Queue now holds ${flakyQueue.deadLetterQueue.length} permanently failed job(s).`);
  flakyQueue.stop();
}

async function actThreeSharding() {
  heading('ACT 3 - Database Sharding (doc.md)');
  console.log('doc.md worked example: userId % 3, users 15, 230, 987, 1500.');

  const router = new ShardRouter(3, 'hash');
  for (const userId of [15, 230, 987, 1500]) {
    const shard = router.shardIndexFor(userId);
    console.log(`  User ${userId} -> Shard ${shard}`);
  }

  step('Simulating Oja growing to a larger user base (hash-based routing)');
  const bigRouter = new ShardRouter(3, 'hash');
  const sampleUserIds = Array.from({ length: 12 }, (_, i) => 1000 + i * 137);
  for (const userId of sampleUserIds) {
    await bigRouter.writeUser(userId, { id: userId, email: `user${userId}@oja.example` });
  }
  console.log('  Distribution across shards:', bigRouter.distributionSummary());

  const lookupId = sampleUserIds[5];
  const { shardIndex } = await bigRouter.readUser(lookupId);
  console.log(`  Login lookup for user ${lookupId} -> only Shard ${shardIndex} is queried (not all shards).`);

  step('Why sharding is usually a last resort');
  console.log('  Stage 1: single PostgreSQL -> Stage 2: + Redis cache -> Stage 3: + read replicas');
  console.log('  Stage 4: partition large tables -> Stage 5: shard (most apps never need this).');
}

async function main() {
  await actOneModularMonolith();
  await actTwoTrafficSpikeAndRetries();
  await actThreeSharding();

  heading('Done - see README.md for how each file maps back to doc.md');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
