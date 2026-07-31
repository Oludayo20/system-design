# 03 — Asynchronous Processing with Queues

A reference implementation of one idea: **don't make users wait for slow work — queue it, and
process it after you've already answered them.** This is how Uber, Amazon, Stripe, Shopify, and
Instagram keep their APIs fast while still doing a lot of work per request.

This project builds it twice, on purpose:

- **RabbitMQ** for the Uber ride example — a job that should be done by exactly *one* worker,
  with a real automatic-retry + dead-letter-queue mechanism.
- **Kafka** for a broadcast comparison — the same event consumed independently by *several*
  services, to make the RabbitMQ-vs-Kafka distinction concrete instead of just a table.

## Producer / Queue / Consumer

- **Producer** — the app creating work. Here, `RidesController`/`RidesService`. Instead of
  `await sendEmail(...)`, it does `await queue.publish({ type: 'SEND_EMAIL', ... })` and returns.
  It never awaits the side effect, only the (cheap) act of handing the job to the broker.
- **Queue** — a waiting line. Like a supermarket checkout: jobs wait, workers pick them up as
  they free up. Here, RabbitMQ's `email.queue` / `analytics.queue` / `loyalty.queue`.
- **Consumer / Worker** — runs in its own process, independent of the request/response cycle,
  continuously pulling jobs and processing them. Here, `src/worker.main.ts`.

## The problem, worked through the Uber example

After a ride ends, a naive handler does this, serially, all inside the HTTP request:

| Step                | Time  |
|----------------------|------|
| Save the trip         | 100ms |
| Charge the card       | 500ms |
| Generate PDF receipt  | 2s    |
| Send email             | 3s    |
| Update analytics       | 1s    |
| **Total**              | **~6-7s** |

The rider stares at a spinner for 6-7 seconds. Bad UX, and if the email provider is slow that
day, the whole request hangs with it.

**The async fix:** save the trip, charge the card (still synchronous — the rider needs to know
*now* if their card was declined), then publish one event and return.

| Step                              | Time |
|-------------------------------------|------|
| Save the trip                        | 100ms |
| Charge the card                      | 500ms |
| Publish `ride.completed`             | ~few ms |
| **Respond to the rider**             | **~200ms total** |
| *(background, after the response)* Receipt worker, Analytics worker, Loyalty worker | 0.6-3s each, in parallel, in another process |

The rider sees "Trip Completed" in ~200ms. The receipt PDF, the email, the analytics record, and
the loyalty points all still happen — just not on the rider's clock.

`POST /rides` in this repo implements exactly this: it does the DB write and the publish, and
nothing else.

## RabbitMQ vs Kafka

| RabbitMQ | Kafka |
|---|---|
| Best for background jobs | Best for event streaming |
| Removes messages after processing (typically) | Retains events for replay |
| Queues | Topics |
| Task distribution | Event distribution |
| Emails, notifications | Analytics, activity streams |

Concretely, in this repo:

- **RabbitMQ / `ride_events`** — `ride.completed` is published once and fans out to three
  *queues*; whichever worker replica pulls a given message from `email.queue` is the one and
  only worker that processes it. A job is completed by exactly one consumer.
- **Kafka / `order-events`** — `order.created` is published once and every subscribed *consumer
  group* (`inventory-group`, `analytics-group`, `fraud-group`) gets its own full copy of the
  stream, tracked by its own offset. Adding a fourth consumer group tomorrow doesn't take
  anything away from the other three, and a group can reset its offset to replay history it
  already saw (see [Kafka replay](#kafka-replay) below). RabbitMQ queues don't offer that:
  once a message is acked, it's gone.

## RabbitMQ topology: retry + dead letter queue

Implemented with plain AMQP 0-9-1 features — a topic exchange, a direct exchange, and per-queue
TTL/dead-letter-exchange arguments — not the delayed-message-exchange plugin, so it runs on any
stock RabbitMQ image.

```
producer (POST /rides)
     |
     |  publish "ride.completed"
     v
ride_events  (topic exchange)
     |
     +----------------+----------------+
     v                v                v
email.queue     analytics.queue   loyalty.queue
     |
     |  handler throws
     v
attempt < 3 ?
     |                                  \
    yes                                  no
     |                                    \
     v                                     v
email.queue.retry                  email.queue.dead-letter
(x-message-ttl: 30000ms)           (inspected manually — never auto-drained)
(x-dead-letter-exchange: ride_events.dlx)
(x-dead-letter-routing-key: email.queue)
     |
     |  TTL expires — RabbitMQ auto-redelivers
     v
ride_events.dlx  (direct exchange)
     |  routing key "email.queue"
     v
email.queue   <-- back where it started, attempt count now in the x-retry-count header
```

Mechanics (`src/common/rabbitmq/topology.ts`, `retry.util.ts`, `consume-with-retry.ts`):

- Every work queue (`email.queue`, `analytics.queue`, `loyalty.queue`) has a matching
  `*.retry` queue and a matching `*.dead-letter` queue.
- On handler success: **ack**.
- On handler failure: read `x-retry-count` from the message headers, increment it.
  - If the new count is below `MAX_DELIVERY_ATTEMPTS` (3): republish the message to
    `*.retry` with the updated header, ack the original delivery. The retry queue's
    30s TTL (`RETRY_TTL_MS`) expires, and its `x-dead-letter-exchange` /
    `x-dead-letter-routing-key` arguments cause RabbitMQ to redeliver the message straight
    back to the main queue — no application timer required.
  - If attempts are exhausted: republish to `*.dead-letter` instead, ack the original.
- The retry count lives in a **message header**, not the JSON body, because it's transport
  metadata, not domain data — handlers never need to know about it, and the same
  `consumeWithRetry` helper works unmodified for all three queues.
- The pure decision — "given this attempt count, do we retry or dead-letter?" — is
  `shouldDeadLetter(attempt, maxAttempts)` in `retry.util.ts`, unit-tested without a broker.

The **Email worker** randomly fails a configurable fraction of jobs (`EMAIL_FAILURE_RATE`,
default `0.3`) specifically so this path is exercisable without manually killing anything — see
[Watching retry + DLQ in action](#watching-retry--dlq-in-action).

## AWS Lambda as an alternative to a long-running worker

This repo runs workers as an always-on process (`node dist/worker.main.js`) that you scale with
`--scale worker=N`. An alternative architecture skips owning that process entirely:

```
Queue (e.g. SQS, or RabbitMQ via an event-source adapter) -> AWS Lambda -> runs the handler -> stops
```

Trade-offs versus a long-running worker fleet:

- **Cost model** — Lambda bills per invocation/duration; you pay nothing while idle. A worker
  fleet runs (and costs money) 24/7 regardless of queue depth.
- **Scaling** — Lambda scales concurrency automatically per message volume, no `--scale`
  command needed; a self-managed fleet needs you (or an autoscaler watching queue depth) to
  decide replica count.
- **Cold starts / connection reuse** — a long-running worker keeps a warm RabbitMQ/DB
  connection across jobs; Lambda invocations pay a cold-start cost and typically can't hold a
  persistent AMQP channel open the way this repo's `consumeWithRetry` does, since RabbitMQ
  consumption is a long-lived subscription, not a per-message poll (this pattern fits SQS/Kafka
  better than RabbitMQ for that reason).
- **Operational surface** — no servers/containers to patch or right-size for Lambda; in
  exchange you give up direct control over runtime, retry semantics, and concurrency limits
  are provider-defined.

For this repo's RabbitMQ topology specifically, a Lambda-based worker would most naturally
replace `worker.main.ts` with a Lambda function subscribed via SQS (with RabbitMQ's messages
bridged over, or by using SQS/EventBridge in place of RabbitMQ altogether) — a straightforward
swap of the *consumer* half of the architecture without touching the producer.

## Traffic spikes

Flash sale: 100 emails/min becomes 100,000/min. Without a queue, the API tries to send them
all synchronously and falls over. With this architecture: `POST /rides` still does exactly one
INSERT and one `channel.publish` — O(1) work regardless of how backed up the workers are — so
100,000 jobs simply queue up in `email.queue`, and however many workers you're running (1, or
20 via `--scale worker=20`) drain it as fast as they can. The API's latency doesn't move; only
the *queue depth* (visible in the RabbitMQ management UI) and the time-to-drain change.

See [Traffic-spike demo](#traffic-spike-demo-scale-workers) below to reproduce this.

## Project layout

```
src/
  main.ts              Producer entrypoint — HTTP API (Nest, with an HTTP server)
  worker.main.ts        Consumer entrypoint — standalone Nest application context, no HTTP
  app.module.ts          API module: Postgres + RabbitMQ + RidesModule
  worker.module.ts       Worker module: RabbitMQ + WorkersModule (no HTTP, no DB)
  config/                 Env-driven configuration
  common/rabbitmq/         Topology, retry/DLQ decision logic, RabbitMQ service
  rides/                   POST /rides — producer (entity, DTO, service, controller)
  workers/                  Email / Analytics / Loyalty workers (consumers)
  kafka/                     Standalone Kafka broadcast-comparison scripts
scripts/
  load-test.ts             Concurrent POST /rides fire, for the traffic-spike demo
```

## Running it

### Prerequisites

Docker (Postgres, RabbitMQ, Kafka) + Node 20+ for `npm run build`/`npm test` locally.

### 1. Install and validate (no Docker needed for this part)

```bash
npm install
npm run build
npm test
```

`npm run build` produces two independently-runnable entrypoints: `dist/main.js` (API) and
`dist/worker.main.js` (worker). `npm test` runs the pure-logic unit tests (retry/DLQ decision
logic, and that `RidesService` publishes and returns without any worker dependency) — no broker
or database required.

### 2. Start infrastructure

```bash
cp .env.example .env
docker compose up -d
```

This starts Postgres, RabbitMQ (management UI at http://localhost:15672, default
`async_demo` / `async_demo_password`), Kafka (KRaft mode, single broker, on `localhost:9092`),
the `api` service on port 3000, and one `worker` replica.

### 3. Or run the API/worker locally instead of in Docker

```bash
npm run start:dev          # API, with reload
npm run start:worker:dev   # worker, in a second terminal
```

(Point `.env` at `localhost` for Postgres/RabbitMQ if you're running `docker compose up -d
postgres rabbitmq` but the app itself outside Docker.)

### 4. Call the producer

```bash
curl -s -X POST http://localhost:3000/rides \
  -H 'Content-Type: application/json' \
  -d '{
    "riderId": "rider-42",
    "driverId": "driver-7",
    "fare": 24.50,
    "pickupLocation": "Ikeja, Lagos",
    "dropoffLocation": "Lekki, Lagos"
  }' | jq
```

```json
{ "success": true, "rideId": "5f1b6b2e-..." }
```

That response comes back in well under a second — Swagger docs are at http://localhost:3000/docs.

### 5. Watch the workers

```bash
docker compose logs -f worker
```

You'll see the Email, Analytics, and Loyalty workers log independently, each after the HTTP
response above already returned:

```
[EmailWorker] Receipt emailed to rider rider-42 for ride 5f1b6b2e-... (fare $24.50, ...)
[AnalyticsWorker] Recorded sale analytics for ride 5f1b6b2e-...: fare $24.50
[LoyaltyWorker] Awarded 25 loyalty points to rider rider-42 for ride 5f1b6b2e-...
```

### Watching retry + DLQ in action

`EMAIL_FAILURE_RATE` (default `0.3`) makes the Email worker randomly throw on ~30% of jobs.
POST a handful of rides and watch `docker compose logs -f worker`:

```
[EmailWorker] email.queue: attempt 1/3 failed (Simulated email provider outage ...) — retrying via email.queue.retry in 30000ms
...30s later, redelivered automatically by the TTL + DLX...
[EmailWorker] Receipt emailed to rider rider-42 for ride 5f1b6b2e-...
```

To force a job all the way to the dead letter queue, set a higher failure rate before starting
the workers, e.g. `EMAIL_FAILURE_RATE=1` in `.env` (or override it for one run:
`docker compose up -d --scale worker=1 -e EMAIL_FAILURE_RATE=1` isn't valid compose syntax —
instead set it in `.env` and `docker compose up -d worker`). After 3 failed attempts you'll see:

```
[EmailWorker] email.queue: attempt 3/3 failed (...) — routing to email.queue.dead-letter
```

Inspect `email.queue.dead-letter` in the RabbitMQ management UI
(http://localhost:15672/#/queues) — messages sit there for manual inspection and never
auto-retry again.

### Traffic-spike demo: scale workers

```bash
docker compose up -d --scale worker=1
npm run load-test           # LOAD_TEST_REQUESTS=500 LOAD_TEST_CONCURRENCY=500 by default
```

Note the reported p50/p95/p99 for `POST /rides` and how long `email.queue` takes to drain
(watch it in the management UI). Then:

```bash
docker compose up -d --scale worker=20
npm run load-test
```

The **API's** request latency stays flat in both runs — it only ever does an INSERT and a
publish. What changes is how fast the (now 100,000-job-deep, in a real flash sale) queue drains,
because you added consumers, not because the producer got faster.

### Kafka broadcast demo

Independent of the RabbitMQ flow above — run these from the host (needs `KAFKA_BROKERS` in
`.env`, defaults to `localhost:9092`, which `docker compose up -d kafka` exposes):

```bash
npm run kafka:consume:inventory   # terminal 1
npm run kafka:consume:analytics   # terminal 2
npm run kafka:consume:fraud       # terminal 3
npm run kafka:produce             # terminal 4 — publishes 10 order.created events
```

All three consumers log every event:

```
[inventory-worker] received order.created orderId=... partition=0 offset=7 — processed independently of the other consumer groups
[analytics-worker] received order.created orderId=... partition=0 offset=7 — processed independently of the other consumer groups
[fraud-worker] received order.created orderId=... partition=0 offset=7 — processed independently of the other consumer groups
```

Same event, three independent consumer groups, three independent offsets — contrast with
RabbitMQ above, where a `ride.completed` job going to a worker removes it from that queue for
everyone else.

#### Kafka replay

Because Kafka retains events (rather than deleting them once read, like a RabbitMQ queue does),
a consumer group can be rewound to reprocess history — e.g. after fixing a bug in
`analytics-group`'s handler. Using kafkajs's admin API:

```ts
const admin = kafka.admin();
await admin.connect();
await admin.resetOffsets({ groupId: 'analytics-group', topic: 'order-events', earliest: true });
await admin.disconnect();
```

This resets `analytics-group`'s committed offset back to the start of the topic; the next time
that group's consumer runs, it re-reads every retained `order.created` event from the
beginning — something a RabbitMQ queue, which discards messages once acked, cannot do.

## Tests

```bash
npm test
```

- `src/rides/rides.service.spec.ts` — proves `RidesService.completeRide` saves the ride,
  publishes `ride.completed` to the `ride_events` exchange with the ride payload, and returns
  `{ success: true, rideId }` — using a mocked `RabbitmqService`, so no broker is needed and no
  worker code is anywhere on its dependency graph.
- `src/common/rabbitmq/retry.util.spec.ts` — proves `shouldDeadLetter`/`nextAttempt`, the pure
  functions driving the retry-vs-dead-letter decision, without needing a live RabbitMQ
  connection.
