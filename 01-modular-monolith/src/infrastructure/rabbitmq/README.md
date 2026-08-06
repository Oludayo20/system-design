# RabbitMQ: How It Works and Why

RabbitMQ is the **domain event bus** between modules. It lets Ordering announce "an order was placed" without knowing or waiting for Inventory, Notifications, or any future subscriber.

---

## The problem without a message broker

```typescript
// ordering.service.ts — the anti-pattern
async placeOrder() {
  const order = await this.saveOrder();
  await this.inventoryService.decrement(order);      // coupling
  await this.notificationsService.sendEmail(order);  // 5+ second block
  return order;
}
```

Problems:
1. **Latency** — customer waits for email.
2. **Coupling** — Ordering imports every downstream module.
3. **Fragility** — email failure fails checkout.
4. **Scale** — cannot scale email workers independently.

RabbitMQ inserts a **buffer** between "order saved" and "react to order."

---

## How publishing works

### 1. Ordering commits order to Postgres

Order is durable. Customer-facing state is settled.

### 2. Ordering calls EventBus

```typescript
// event-bus.service.ts
async publish(routingKey, payload) {
  const envelope = {
    event: routingKey,
    timestamp: new Date().toISOString(),
    payload,
  };
  await amqpConnection.publish('domain_events', routingKey, envelope);
}
```

**Why wrap in an envelope?** Every consumer gets consistent metadata (`event`, `timestamp`) for logging, tracing, and future replay tools. Payload stays module-specific.

**Why centralize in EventBus?** Modules never hardcode exchange names or touch `AmqpConnection` directly. Change broker topology in one place.

### 3. Fire-and-forget from HTTP path

```typescript
void this.eventBus.publish(...).catch(err => this.logger.error(...));
```

**What `void` means here:** Ordering does not `await` publish before returning HTTP response. The customer gets `{ success, orderId }` immediately.

**What still happens:** `publish()` does await RabbitMQ accepting the message (broker ACK). If broker is down, error is logged — order exists but event may be lost. **Production fix:** transactional outbox (insert event row in same DB transaction as order, background worker publishes).

---

## How the broker routes messages

```
Publisher: OrderingService
     │
     ▼
Exchange: domain_events (type: topic)
     │
     │ routing key: order.created
     │
     ├──────────────────┬──────────────────┐
     ▼                  ▼                  ▼
Queue:              Queue:              (future)
inventory.          notifications.
order_created       order_created
     │                  │
     ▼                  ▼
InventoryConsumer   NotificationsConsumer
```

**Why topic exchange?** Routing keys can grow (`order.created`, `order.cancelled`, `product.updated`) without new exchanges. Subscribers bind queues to keys they care about.

**Why separate queues per consumer?** **Competing consumers** on one queue share work (good for horizontal scale of *same* handler). **Separate queues** for different handlers = **fan-out** (each gets every message). Inventory and Notifications both need every `order.created` — fan-out is correct.

**Why durable queues?** Survive broker restart. In-flight and queued messages persist to disk (with persistent messages).

---

## How consumers subscribe

```typescript
@RabbitSubscribe({
  exchange: DOMAIN_EVENTS_EXCHANGE,
  routingKey: RoutingKeys.ORDER_CREATED,
  queue: 'inventory.order_created',
  queueOptions: { durable: true },
})
async handleOrderCreated(envelope: EventEnvelope<OrderCreatedEvent>) { ... }
```

**How binding appears at runtime:** `@golevelup/nestjs-rabbitmq` with `enableControllerDiscovery: true` scans providers at boot, declares exchange (from module config), creates queue, binds queue to exchange with routing key.

**Why declare topology in code not RabbitMQ UI?** Reproducible across dev/staging/prod. `docker compose up` on a fresh machine gets correct queues without manual clicks.

---

## How rabbitmq.module.ts fits

Wraps `@golevelup/nestjs-rabbitmq` so the rest of the app imports `EventBus` only.

```typescript
GolevelupRabbitMQModule.forRootAsync({
  uri: RABBITMQ_URL,
  exchanges: [{ name: 'domain_events', type: 'topic' }],
  connectionInitOptions: { wait: true, timeout: 20_000 },
  enableControllerDiscovery: true,
})
```

**Why `wait: true`?** API process waits for RabbitMQ connection before accepting traffic — consumers are registered before first `order.created`.

**Why global module?** Any module can inject `EventBus` without importing `RabbitmqModule` in each feature module.

---

## Routing keys registry

`rabbitmq.constants.ts`:

```typescript
export const RoutingKeys = {
  ORDER_CREATED: 'order.created',
  ORDER_CANCELLED: 'order.cancelled',
} as const;
```

**Why a shared constants file?** Publisher and subscribers must use identical strings. Typos cause silent message loss (no queue bound). Single source of truth.

---

## Mnesia log noise in Docker

You may see repeated logs:

```
Waiting for Mnesia tables for 30000 ms, 9 retries left
Successfully synced tables from a peer
```

**What it is:** RabbitMQ's internal Erlang database syncing cluster metadata.

**Why it appears on single-node Docker:** Harmless info-level chatter when management plugin or healthchecks connect.

**Is it a problem?** No — if messages flow and consumers process orders, ignore it.

---

## Extracting consumers to microservices

Inventory and Notifications already:
- Have no HTTP surface
- Depend only on event payload + `CatalogService` (Inventory)
- Use named durable queues

To extract:
1. Move consumer to new repo.
2. Point at same `RABBITMQ_URL` and queue names.
3. Ordering unchanged — still calls `EventBus.publish`.

The event contract (`OrderCreatedEvent` + envelope) **is** the public API between services.

---

## Production patterns not in demo

| Pattern | Solves |
|---------|--------|
| Dead-letter exchange (DLX) | Poison messages after N failures |
| Retry with backoff | Transient consumer errors |
| Transactional outbox | Order committed but publish failed |
| Idempotent consumers | Duplicate `order.created` delivery |

---

## Key files

| File | Role |
|------|------|
| `event-bus.service.ts` | Only publish API for modules |
| `rabbitmq.constants.ts` | Exchange name, routing keys, envelope type |
| `rabbitmq.module.ts` | Connection, exchange declaration, discovery |
