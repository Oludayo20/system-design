# Serverless Architecture — A Hand-Built Local FaaS Emulator

Project 10 of the system design series. This one demonstrates **Serverless Architecture**: you
write small functions with an AWS-Lambda-shaped handler signature `(event, context) => response`;
a platform invokes them only when triggered; the platform manages scaling; and you pay only for
execution time.

> **What's real vs. simulated here**
>
> Real AWS Lambda, API Gateway, EventBridge, SQS, and S3 can't run in this environment, so this
> project is a **hand-built local emulator**, not "real AWS Lambda." Read this callout before you
> read anything else in this README.
>
> | | |
> |---|---|
> | **Real** | Actual added cold-start latency, measured with a real `Date.now()` clock and injected with a real `await`ed delay — provable with `curl`'s own timing. Actual scale-to-zero: a background sweeper really evicts idle instances and they are really gone (the next invocation is really cold again). Actual per-invocation timing and billing math, computed from real wall-clock handler duration. Actual concurrent burst handling: a burst of queue messages really does spin up multiple concurrent logical execution instances, not a canned log message. |
> | **Simulated** | There is no real S3, EventBridge, Lambda runtime, or API Gateway. `resizeProductImage` doesn't touch a real image. "Execution environments" are logical objects inside one Node process, not real containers/microVMs. `POST /_simulate/s3-upload` exists only because there's no real S3 bucket to drop a file into locally. |
>
> This is the same honesty standard as [`05-resilience`](../05-resilience) (a real circuit breaker
> around a simulated flaky payment provider) and [`06-cap-theorem`](../06-cap-theorem) (two real
> in-memory nodes standing in for a real cluster).

## Concept, in my own words

Serverless (FaaS — Function as a Service) means you stop thinking about servers and think about
functions instead:

1. **You write a function**, not a server. It takes an `event` (what triggered it) and a
   `context` (metadata about this invocation) and returns a response — that's the whole contract.
2. **The platform invokes it only when triggered.** No trigger, no running process, no cost. An
   HTTP request, a message landing on a queue, a schedule firing, a file being uploaded — any of
   these can be the trigger.
3. **The platform manages scaling.** One request or ten thousand concurrent requests — the
   platform decides how many copies of your function to run. You never provision capacity.
4. **You pay only for execution time**, billed in small rounded-up increments (AWS Lambda bills
   in 1ms increments today; classic Lambda billing — and this demo — rounds to 100ms), not for
   idle time. A function that never runs costs nothing.
5. **Cold starts** happen because "no server running" is the whole point — when a function hasn't
   run recently, there's no warm process sitting around to handle the next invocation. The
   platform has to spin up a fresh execution environment first: load your code, run any
   module-level initialization (open connections, read config), then run your handler. That setup
   cost is the cold start. If the same function is invoked again soon after, the platform reuses
   the still-warm environment and skips all of that — a warm start.

### Serverless is an axis, not a replacement

The most common confusion: serverless is not "instead of microservices" or "instead of
event-driven architecture." It answers a completely different question than either of those.

| Architecture | Answers the question | Unit of deployment | How it scales |
|---|---|---|---|
| **Monolith** | How is the codebase organized? | One process, one deployable | Scale the whole thing (vertically, or as replicas) |
| **Modular monolith** | How is the codebase organized? | One process, internally partitioned into modules with clear boundaries | Same as monolith; a module can later be extracted |
| **Microservices** | How is the codebase organized? | Many independently deployable services, one per bounded context | Scale each service independently |
| **Event-driven architecture** | How do components communicate? | Producers publish events; consumers subscribe and react, decoupled from each other | Add more consumers of the same event stream |
| **Serverless (FaaS)** | How does the code actually run? | Individual functions, each invoked on demand | Platform scales invocations automatically, including to zero |

Two things fall out of that table:

- **Serverless is orthogonal to monolith vs. microservices.** That axis is about how you split
  code into deployable units. Serverless is about the execution model each unit runs under. You
  could deploy a monolith's request handler as a single big Lambda, or split a microservices
  fleet so each service's endpoints are their own functions — the trigger/scale/pay-per-use
  mechanics are the same either way.
- **Serverless is orthogonal but complementary to event-driven architecture.** Event-driven is
  about *how components talk to each other* (publish/subscribe). Serverless is about *how the
  listening code actually executes*. They pair naturally — "a queue message triggers a function"
  is both an event-driven hand-off and a serverless invocation at once, which is exactly what the
  queue trigger in this project demonstrates — but you can have either one without the other:
  a scheduled Lambda invoked by cron has no event-driven component, and an event-driven system
  built from long-running Kafka consumers has no serverless component.

## What this repo implements

```text
                              ┌─────────────────────────────┐
   HTTP request               │                              │
   POST /orders  ─────────────►                              │
                              │                              │
   File-drop simulation       │   Execution-Environment      │      functions/
   POST /_simulate/s3-upload ─►   Manager                     ├──► createOrder
                              │   (runtime/execution-         │    resizeProductImage
   Schedule (interval/cron)   │    environment-manager.ts)    ├──► dailySalesReport
   every SCHEDULE_INTERVAL_MS─►                              │    processPaymentQueueMessage
                              │   - warm instance pool        │
   Queue message               │   - cold start (real delay)  │
   payment-queue (RabbitMQ) ───►   - TTL sweeper (scale-to-0)  │
                              │   - per-invocation billing    │
                              └─────────────────────────────┘
```

Every trigger is a thin adapter that calls `manager.invoke(functionName, event)` — the same
method, regardless of what fired it. That's the point being demonstrated: triggers are just
different front doors onto one runtime.

| Piece | Where it lives | Role |
|---|---|---|
| Execution-environment manager | `runtime/execution-environment-manager.ts` | Warm instance pool, cold-start simulation, TTL sweeper, per-invocation billing, stats |
| Handler contract | `runtime/types.ts` | `(event, context) => { statusCode, body }` — the AWS-Lambda-shaped signature every function implements |
| RabbitMQ connection helper | `runtime/rabbitmq.ts` | Connects with retry, asserts `payment-queue` |
| `apiGateway` trigger | `triggers/api-gateway.ts` | HTTP → `POST /orders` → `createOrder` |
| File-drop trigger | `triggers/file-drop-trigger.ts` | `POST /_simulate/s3-upload` → `resizeProductImage` (stands in for an S3 event notification) |
| Schedule trigger | `triggers/schedule-trigger.ts` | Interval timer → `dailySalesReport` (stands in for an EventBridge cron rule) |
| Queue trigger | `triggers/queue-trigger.ts` | RabbitMQ `payment-queue` consumer → `processPaymentQueueMessage`, concurrently (stands in for SQS → Lambda) |
| `createOrder` | `functions/createOrder.ts` | Validates body, creates an order in the in-memory store, returns 201 |
| `resizeProductImage` | `functions/resizeProductImage.ts` | Simulates a resize (sleep + fake output key) |
| `dailySalesReport` | `functions/dailySalesReport.ts` | Sums the in-memory order store, logs a report |
| `processPaymentQueueMessage` | `functions/processPaymentQueueMessage.ts` | Processes one queue message per invocation |
| Shared backing store | `store/order-store.ts` | In-memory Map standing in for a real database (e.g. DynamoDB) — see comment in that file for why |

**Every file under `functions/` has zero framework code in it** — no Express `req`/`res`, no
amqplib types, nothing from `runtime/` beyond the plain `FunctionContext`/`FunctionResponse`
types. Each one only knows `(event, context) => response`. That's what makes them portable: the
exact same `createOrder.ts` could be deployed to real AWS Lambda behind real API Gateway without
changing a line.

## Run it

> **Hosting & deployment:** see [HOSTING.md](./HOSTING.md) for the Docker setup and what it would
> take to run patterns like these against real serverless platforms.

```bash
cp .env.example .env
docker compose up --build -d
```

This starts:

| Service | Port | Purpose |
|---|---|---|
| `api` | `3010` | HTTP surface: `apiGateway` trigger, `_simulate` endpoints, `/_runtime/stats` |
| `rabbitmq` | `5673` (AMQP), `15673` (management UI) | Backs the queue trigger only |

Tune behavior in `.env`:

- `WARM_TTL_MS` (default `60000`) — how long an idle instance stays warm before scale-to-zero
- `COLD_START_LATENCY_MS` (default `400`) — real injected cold-start delay
- `SCHEDULE_INTERVAL_MS` (default `30000`) — how often `dailySalesReport` fires

### Try it — prove the cold start

```bash
# 1. First call — nothing warm yet, so this is a cold start. Time it.
curl -i -X POST http://localhost:3010/orders \
  -H 'Content-Type: application/json' \
  -d '{"customerId": "cust_1", "items": [{"sku": "sku_42", "qty": 2}]}'
```

Look at the response — both the headers and the JSON body carry the same proof:

```text
HTTP/1.1 201 Created
X-Cold-Start: true
X-Billed-Duration-Ms: 500
...
{
  "order": { "id": "order_1", "customerId": "cust_1", ... },
  "runtime": { "functionName": "createOrder", "cold": true, "durationMs": 401, "billedMs": 500, ... }
}
```

```bash
# 2. Immediately call it again — the instance is still warm (well under WARM_TTL_MS).
curl -i -X POST http://localhost:3010/orders \
  -H 'Content-Type: application/json' \
  -d '{"customerId": "cust_1", "items": [{"sku": "sku_42", "qty": 1}]}'
```

```text
X-Cold-Start: false
X-Billed-Duration-Ms: 100
...
"runtime": { "cold": false, "durationMs": 2, "billedMs": 100, ... }
```

Notice `durationMs` dropped by roughly `COLD_START_LATENCY_MS` — that's the real injected delay
disappearing because no fresh environment had to initialize this time.

```bash
# 3. Wait past WARM_TTL_MS (default 60s — lower it in .env for faster demos, e.g. WARM_TTL_MS=8000)
sleep 65

# 4. Call again — the sweeper already evicted the idle instance, so this is cold again.
curl -i -X POST http://localhost:3010/orders \
  -H 'Content-Type: application/json' \
  -d '{"customerId": "cust_1", "items": [{"sku": "sku_42", "qty": 3}]}'
# X-Cold-Start: true again
```

You can also watch the eviction happen in the logs in real time:

```bash
docker compose logs -f api | grep sweeper
# [sweeper] evicted createOrder instance=<uuid> (idle 61023ms > TTL 60000ms) — scaled to zero
```

```bash
# 5. See the accumulated billing and cold/warm counts across everything invoked so far.
curl http://localhost:3010/_runtime/stats
```

```json
{
  "createOrder": { "invocations": 3, "coldStarts": 2, "warmStarts": 1, "totalBilledMs": 700, "warmInstances": 1 },
  "resizeProductImage": { "invocations": 0, "coldStarts": 0, "warmStarts": 0, "totalBilledMs": 0, "warmInstances": 0 },
  "dailySalesReport": { "invocations": 4, "coldStarts": 1, "warmStarts": 3, "totalBilledMs": 400, "warmInstances": 1 },
  "processPaymentQueueMessage": { "invocations": 0, "coldStarts": 0, "warmStarts": 0, "totalBilledMs": 0, "warmInstances": 0 }
}
```

### Try it — the file-drop trigger

There's no real S3 locally, so this endpoint stands in for "S3 invoked Lambda on upload":

```bash
curl -i -X POST http://localhost:3010/_simulate/s3-upload \
  -H 'Content-Type: application/json' \
  -d '{"bucket": "oja-product-images", "key": "product-42/original.jpg"}'
# "outputKey": "product-42/original-resized.jpg"
```

### Try it — the queue-burst concurrency demo

```bash
# Publish 10 payment messages at once.
curl -X POST http://localhost:3010/_simulate/payment-burst \
  -H 'Content-Type: application/json' \
  -d '{"count": 10}'

# Watch the queue trigger consume them concurrently and report the burst.
docker compose logs -f api | grep queue-trigger
```

```text
[queue-trigger] message acked — cold=true billed=200ms
[queue-trigger] message acked — cold=true billed=200ms
... (all 10 arrive and get acked in quick succession, not one at a time)
[queue-trigger] burst complete — peak concurrency=10, cold starts this burst=10
```

Because nothing was warm yet, all 10 concurrent messages each spun up their own execution
instance — the same way Lambda scales out concurrent execution environments to drain an SQS
backlog. Run the burst again immediately (before `WARM_TTL_MS` elapses) and you'll see a mix of
warm reuse and cold starts, since some of the first batch's instances are still idle-but-warm.

```bash
curl http://localhost:3010/_runtime/stats | jq '.processPaymentQueueMessage'
```

### Try it — the schedule trigger

No curl needed — it fires on its own every `SCHEDULE_INTERVAL_MS`:

```bash
docker compose logs -f api | grep -E 'schedule-trigger|dailySalesReport'
```

```text
[schedule-trigger] dailySalesReport scheduled every 30000ms (stands in for a cron/rate expression)
[dailySalesReport] report generated: {"generatedAt":"...","ordersProcessed":3,"totalRevenue":6000}
[schedule-trigger] fired — cold=false duration=1ms billed=100ms
```

Create a few orders first (`POST /orders`), then watch the next scheduled firing pick up the
updated total.

### Stop

```bash
docker compose down -v
```

## Tests

```bash
npm install
npm test
```

`runtime/execution-environment-manager.spec.ts` proves, with real timers and no HTTP server or
RabbitMQ required: cold-then-warm behavior, that cold-start latency is a real awaited delay (not
a label), TTL-based re-cold-starting, 100ms-rounded billing accumulation, and that concurrent
invocations with nothing idle yet each get their own instance.

## Related projects

| Project | Connection to serverless |
|---|---|
| `03-async-queue-processing` | The RabbitMQ worker pattern this project's queue trigger stands next to — a long-running worker process vs. a function invoked per message |
| `05-resilience` | Same "honest local simulation of a hard-to-run-locally concept" approach: real circuit breaker, simulated flaky dependency |
| `06-cap-theorem` | Same approach again: real two-node behavior, simulated cluster |
