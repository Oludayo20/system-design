# 09 — Event-Driven Architecture ("FreshCart")

A reference implementation of one idea: **a service publishes a fact that already happened, and
has no idea — and no need to know — who's listening.** That's the difference between calling a
function and publishing an event. This project is FreshCart, a grocery delivery app: placing an
order fans out to four completely independent services, none of which the order API imports,
calls, or is even aware exists.

## This is NOT `03-async-queue-processing` again

`03-async-queue-processing` already lives in this repo and already covers "don't make the user
wait — queue it." Read that project first if you haven't; this one deliberately does something
different, on the same broker (RabbitMQ), so the contrast is concrete instead of a table you
skim past:

| | `03-async-queue-processing` | `09-event-driven-architecture` (this project) |
|---|---|---|
| **Pattern** | Point-to-point task queueing | Pub/sub fan-out |
| **Producer→consumer shape** | One producer, one logical consumer *per queue* (`email.queue` has one job of work, done by exactly one worker replica) | One producer, **many independent consumers**, each getting its **own full copy** of every event |
| **Adding a new consumer** | Means adding a new queue the producer's topology also has to know about (see `topology.ts` in `03`, which asserts `email.queue`/`analytics.queue`/`loyalty.queue` by name) | Means binding a brand-new queue to an exchange that already exists — **zero changes to the producer**, proven in this repo by `loyalty-consumer` (see below) |
| **A message consumed by worker A** | Is gone — worker B on the same queue will never see it (scale-out = split the work) | Is irrelevant to whether worker B sees it — each consumer has its **own queue**, so four consumers each see 100% of events (scale-out = replicate the reaction, not split it) |
| **Failure handling shown** | Retry + dead-letter queue (TTL/DLX topology) | Idempotent processing of a **redelivered duplicate** (a different failure mode: not "it failed," but "it succeeded twice") |
| **What "ordering" means here** | Retry attempts must be ordered after the original delivery | The event must never be visible before its cause (the DB write) is durable — publish-after-commit |

Both projects queue things. `03` is "one job, done once, by one worker." `09` is "one fact,
broadcast to everyone who cares." If you only remember one line: **queues distribute work,
pub/sub distributes information.**

## Concept, in my own words

An event is a **fact stated in the past tense**: `order.placed`, not `place order`. By the time
anyone downstream sees it, it already happened — there's nothing to negotiate, approve, or
reject about it, only something to react to. That's what makes it safe to publish once and walk
away.

The publisher (`order-api`) sends the event to a broker and is done. It doesn't hold a list of
subscribers, doesn't call anyone's HTTP endpoint, doesn't know if zero services or forty are
listening. Every consumer independently decides what it cares about by binding its own queue —
subscribing is something the *consumer* does, not something the *producer* grants. That's loose
coupling: `loyalty-consumer` in this repo was added after everything else already existed, and
not one line changed in `order-api`, `inventory-consumer`, `notification-consumer`, or
`analytics-consumer` to make room for it.

Because publishing is just "hand the broker a fact and return," the producer's request latency
stops being the sum of everyone who might care. `POST /orders` responds as soon as the order is
saved and the event is handed off — not after stock is decremented, a push notification is sent,
analytics are recorded, and loyalty points are calculated. Those all still happen, just not on
the customer's clock.

None of this is free. Spreading one operation across five independent processes means:

- **Tracing is harder.** A single "place an order" business event now has causally-related
  effects in five different logs, four different processes, at four different times. There's no
  call stack connecting them — only a shared `orderId`/`eventId` you have to think to grep for.
- **Ordering isn't automatic.** Nothing about "publish an event" guarantees anyone processes it
  in any particular order relative to other events, or even relative to the write that produced
  it — you have to engineer that guarantee where it matters (see "Ordering" below).
- **Duplicates are not an edge case, they're the contract.** Brokers offering at-least-once
  delivery — which is what makes them reliable in the first place — can and will redeliver a
  message a consumer already successfully processed. "Might receive the same event twice" isn't
  a bug to route around; it's how the guarantee is built. Consumers have to be idempotent (see
  "Idempotency" below).

## Fan-out topology

```
                         POST /orders
                              │
                              ▼
                        ┌───────────┐        commit         ┌──────────┐
                        │ order-api │ ─────────────────────► │ order-db │
                        └───────────┘                        └──────────┘
                              │
                              │ publish "order.placed"
                              │ (only after the commit above resolves)
                              ▼
                  ┌─────────────────────────┐
                  │   grocery_events         │   topic exchange
                  │   (routing key:          │
                  │    order.placed)         │
                  └─────────────────────────┘
                    │        │        │        │
       ┌────────────┘        │        │        └────────────┐
       ▼                     ▼        ▼                     ▼
┌─────────────────┐ ┌──────────────────┐ ┌────────────────┐ ┌─────────────────┐
│ inventory.       │ │ notification.    │ │ analytics.     │ │ loyalty.         │
│ order-placed.    │ │ order-placed.    │ │ order-placed.  │ │ order-placed.    │
│ queue            │ │ queue            │ │ queue          │ │ queue            │
└─────────────────┘ └──────────────────┘ └────────────────┘ └─────────────────┘
       │                     │                    │                    │
       ▼                     ▼                    ▼                    ▼
┌─────────────────┐ ┌──────────────────┐ ┌────────────────┐ ┌─────────────────┐
│ inventory-       │ │ notification-    │ │ analytics-     │ │ loyalty-         │
│ consumer         │ │ consumer         │ │ consumer       │ │ consumer         │
│ decrements stock │ │ logs a push      │ │ increments     │ │ awards points,   │
│ in inventory-db  │ │ notification     │ │ today's sales  │ │ idempotently     │
│ :4101 GET /stock │ │ :4102 GET        │ │ :4103 GET      │ │ :4104 GET        │
│                  │ │ /notifications   │ │ /stats         │ │ /points          │
└─────────────────┘ └──────────────────┘ └────────────────┘ └─────────────────┘
```

Four separate queues bound to one **topic** exchange (not fanout) — a topic exchange lets this
grow to more event types later (`order.cancelled`, `order.refunded`, ...) with each consumer
choosing exactly which routing keys it wants, without every consumer being forced to receive
every event type the way a true fanout exchange would. Today every consumer here only binds
`order.placed`, so it behaves identically to a fanout exchange in practice — the choice is about
where the ceiling is, not what happens on day one.

## Events and consumers

| Event | Published by | Routing key | Consumers |
|---|---|---|---|
| `order.placed` | `order-api` | `order.placed` | `inventory-consumer`, `notification-consumer`, `analytics-consumer`, `loyalty-consumer` |

Every message on `grocery_events` carries the same envelope:

```json
{
  "eventId": "b3f1c2a0-...-uuid",
  "eventType": "order.placed",
  "occurredAt": "2026-08-08T12:00:00.000Z",
  "payload": {
    "orderId": "5f1b6b2e-...-uuid",
    "customerId": "customer-42",
    "items": [{ "sku": "milk-1l", "name": "Whole Milk 1L", "quantity": 2, "unitPrice": 1.5 }],
    "totalAmount": 3.0
  }
}
```

`eventId` is generated once, when the event is created, and never regenerated on redelivery —
it's the field idempotency keys off (see below).

| App | Role | Port | Inspect with |
|---|---|---|---|
| `order-api` | Producer — the only HTTP write path | `3009` (Swagger `/docs`) | `GET /orders/:id` |
| `inventory-consumer` | Decrements stock in its own `inventory-db` | `4101` | `GET /stock` |
| `notification-consumer` | Logs/stores a push notification (in-memory) | `4102` | `GET /notifications` |
| `analytics-consumer` | Increments running sales counters (in-memory) | `4103` | `GET /stats` |
| `loyalty-consumer` | Awards loyalty points, idempotently (in-memory) | `4104` | `GET /points` |

## Ordering

There are two different things "ordering" could mean here, and FreshCart only needs one of them.

**Cross-consumer ordering — not needed.** `inventory-consumer` decrementing stock does not, and
should not, depend on `notification-consumer` succeeding, or on any particular order relative to
`analytics-consumer`/`loyalty-consumer`. They're four independent reactions to the same fact, not
four steps in a pipeline. If `notification-consumer`'s process is down for five minutes, stock
still gets decremented immediately and correctly — there is no shared state, lock, or "wait for
the notification to send first" anywhere in this system. This is different from, say, a
`PaymentSuccessful`-before-`WalletCredited` scenario, where processing B before A would be
wrong *because B is causally dependent on A's outcome*. Nothing downstream of `order.placed` here
is causally dependent on another *consumer's* output — only on the order itself existing.

**Publish-after-commit — needed, and implemented for real.** The one ordering guarantee that
does matter: `order.placed` must never become visible to a consumer before the order row it
describes is durably committed. If we published inside the transaction (or before starting it),
a consumer could react to an order that a concurrent `GET /orders/:id` — or a read replica, or a
retried transaction that later rolls back — can't actually see. `OrdersService.placeOrder` in
`order-api/src/orders/orders.service.ts` enforces this by construction:

```ts
const order = await this.dataSource.transaction(async (manager) => {
  return manager.save(Order, manager.create(Order, { ...dto, totalAmount, status: 'placed' }));
});
// <-- transaction committed here — everything below only runs because the line above resolved

const event: OrderPlacedEvent = { eventId: randomUUID(), eventType: 'order.placed', ... };
await this.rabbitmq.publish(GROCERY_EVENTS_EXCHANGE, ORDER_PLACED_ROUTING_KEY, event);
```

The `publish` call is a separate statement, textually and temporally after the `await` on the
transaction resolves — not a side effect nested inside it. There's no way for the event to reach
RabbitMQ before Postgres has durably committed the row.

## Idempotency

RabbitMQ (like any broker offering at-least-once delivery) can and does redeliver a message a
consumer already successfully processed — the consumer might crash after doing the work but
before acking, or the broker might decide a delivery needs retrying after a network blip. "The
same event twice" is not a bug to code around; it's the normal cost of the reliability guarantee.
Three of the four consumers here (`inventory-consumer`, `notification-consumer`,
`analytics-consumer`) don't defend against it, on purpose — the point of this project is to
implement the idempotency check *once*, concretely, in the one consumer where a duplicate would
be visibly, financially wrong: `loyalty-consumer`.

`loyalty-consumer` tracks every `eventId` it has already applied (`PointsService`, an in-memory
`Set` for this demo — a real system would put a unique constraint on `event_id` in whichever
table records the side effect). On each delivery:

```ts
if (this.processedEventIds.has(event.eventId)) {
  this.logger.warn(`Duplicate delivery of eventId=${event.eventId} ... skipping`);
  return;
}
// ...award points, then:
this.processedEventIds.add(event.eventId);
```

### Proving it

`loyalty-consumer/scripts/simulate-duplicate-delivery.ts` sends **the same `eventId`, twice**,
directly to `loyalty.order-placed.queue` — the same thing a real RabbitMQ redelivery looks like
on the wire. (It targets the queue directly rather than the `grocery_events` exchange, so the
duplicate doesn't also fan out to the other three consumers, which aren't the ones being tested
here and don't have a dedup guard.)

```bash
cd loyalty-consumer
npm install   # only needed once
npm run simulate:duplicate
```

Expected output:

```
Simulating a duplicate delivery of eventId=<uuid> to loyalty.order-placed.queue
Expect: exactly one award of 42 points to demo-customer-idempotency

Sending delivery #1...
Sending delivery #2 (identical eventId — simulates redelivery)...

Done. Check: curl http://localhost:4104/points
demo-customer-idempotency should show 42 points (not 84), and processedEventCount should have
increased by exactly 1, not 2.
```

```bash
curl -s http://localhost:4104/points | jq
```

```json
{
  "customers": [{ "customerId": "demo-customer-idempotency", "points": 42 }],
  "processedEventCount": 1
}
```

`loyalty-consumer`'s logs (`docker compose logs loyalty-consumer`) show the second delivery being
explicitly recognized and skipped:

```
[PointsService] order.placed (orderId=..., eventId=b7e4...): awarded 42 points to demo-customer-idempotency (total now 42)
[PointsService] Duplicate delivery of eventId=b7e4... (orderId=...) — already processed. Skipping so points are not awarded twice.
```

## Adding `loyalty-consumer` on day 2 — the actual point of this project

`loyalty-consumer` was written and wired up **after** `order-api`, `inventory-consumer`,
`notification-consumer`, and `analytics-consumer` already existed, in production, handling real
traffic. Getting it live required:

- Writing `loyalty-consumer` as a new app (own `package.json`, own `Dockerfile`, own process).
- Binding a new queue (`loyalty.order-placed.queue`) to the `grocery_events` exchange, which
  `order-api` had already created and been publishing to for however long.
- Adding one service block to `docker-compose.yml`.

It did **not** require:

- Touching a single line of `order-api/src/**`.
- Redeploying `order-api`.
- Touching `inventory-consumer`, `notification-consumer`, or `analytics-consumer` at all.
- Any coordination beyond knowing the exchange name and the event's JSON shape (documented
  above) — both of which are already implicitly public just by `order-api` having shipped.

That's the concrete version of "loose coupling," not just the phrase.

## The radio station analogy

Think of `order-api` as a radio station and `grocery_events` as the airwaves. The station
broadcasts its show and does not know — cannot know — who owns a radio and has it tuned to that
frequency. It doesn't call each listener to check they're ready. It doesn't wait for anyone to
finish listening to yesterday's broadcast before starting today's. It just transmits, on
schedule, whether the audience is one person or one million.

Each consumer here is a radio tuned to `grocery_events`, listening for `order.placed`.
`inventory-consumer`, `notification-consumer`, and `analytics-consumer` were already tuned in
when the station went live. `loyalty-consumer` bought a radio and tuned in later — the station
never had to change its transmitter, its schedule, or its programming to be heard by one more
listener. That's the whole trick: the broadcaster couples to a frequency, not to a list of
listeners.

## Project layout

```
09-event-driven-architecture/
├── docker-compose.yml         order-db, inventory-db, rabbitmq, and all 5 apps
├── .env.example
├── order-api/                 producer — POST /orders, GET /orders/:id
│   └── src/orders/            entity, DTOs, publish-after-commit service, controller
├── inventory-consumer/        GET /stock — decrements stock in its own inventory-db
├── notification-consumer/     GET /notifications — in-memory
├── analytics-consumer/        GET /stats — in-memory
└── loyalty-consumer/          GET /points — idempotent, in-memory
    └── scripts/simulate-duplicate-delivery.ts   duplicate-delivery proof
```

Each app is a fully independent NestJS project: its own `package.json`, `tsconfig*.json`,
`nest-cli.json`, `Dockerfile`, `.eslintrc.js`, `.prettierrc`. None of them import from each
other or share a `node_modules`. The only thing they share is an agreement on the exchange name,
routing key, and JSON event shape — documented above, not enforced by a shared package.

## Run it

> **Hosting & deployment:** see [HOSTING.md](./HOSTING.md) for platform options and per-component
> production mapping.

### 1. Install and build each app (no Docker needed for this part)

```bash
for app in order-api inventory-consumer notification-consumer analytics-consumer loyalty-consumer; do
  (cd "$app" && npm install && npm run build)
done
```

Each `npm run build` should complete with zero TypeScript errors.

### 2. Start everything with Docker

```bash
cp .env.example .env
docker compose up --build -d
```

This starts `order-db`, `inventory-db`, `rabbitmq` (management UI at
http://localhost:15672), `order-api` (port `3009`, Swagger at `/docs`), and all four consumers
(`4101`–`4104`).

### Try it

Place an order:

```bash
curl -s -X POST http://localhost:3009/orders \
  -H 'Content-Type: application/json' \
  -d '{
    "customerId": "customer-42",
    "items": [
      { "sku": "milk-1l", "name": "Whole Milk 1L", "quantity": 2, "unitPrice": 1.5 },
      { "sku": "bread-1", "name": "Sliced White Bread", "quantity": 1, "unitPrice": 2.0 }
    ]
  }' | jq
```

That response comes back almost immediately — `order-api` never waits on any consumer. Now
confirm all four reacted independently:

```bash
curl -s http://localhost:4101/stock | jq          # milk-1l and bread-1 quantities decremented
curl -s http://localhost:4102/notifications | jq  # a push notification for the order
curl -s http://localhost:4103/stats | jq          # ordersToday/revenueToday incremented
curl -s http://localhost:4104/points | jq         # customer-42 awarded points
```

Then run the idempotency demo (see above):

```bash
cd loyalty-consumer && npm install && npm run simulate:duplicate
curl -s http://localhost:4104/points | jq
```

### Stop and reset

```bash
docker compose down -v
```

## Tests

```bash
npm run build   # in each app — the validation this project relies on; see HOSTING.md for CI notes
```

No broker-dependent integration tests are included; the idempotency and fan-out behavior above
are demonstrated live against a real RabbitMQ instance instead (`simulate:duplicate` and the
`curl` walkthrough), which is a stronger proof than a mocked unit test for this specific concept.
