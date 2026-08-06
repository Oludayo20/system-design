# Inventory Module: How It Works and Why

Inventory has **no HTTP API**. It is a RabbitMQ consumer that reacts to `order.created` by reducing product stock. It exists to demonstrate **asynchronous side effects** — work that must happen after checkout but must not block the customer.

---

## The problem this module solves

When a customer places an order, stock must decrease. Two ways to do it:

### Bad: synchronous in `placeOrder()`

```typescript
async placeOrder() {
  await saveOrder();
  await decrementStock();  // customer waits
  return { success: true };
}
```

If stock update is slow or fails, checkout fails or slows down. Ordering becomes coupled to inventory logic.

### Good: async consumer (this repo)

```typescript
// OrderingService
await saveOrder();
void eventBus.publish('order.created', ...);
return { success: true };  // customer done

// InventoryConsumer (later, separate queue)
await catalogService.decrementStock(...);
```

Checkout succeeds as soon as the order is saved. Stock updates in parallel. Failures in inventory can be retried without the customer re-submitting checkout.

---

## How the consumer works

`InventoryConsumer.handleOrderCreated()`:

1. RabbitMQ delivers message from queue `inventory.order_created`.
2. Unwrap `envelope.payload` as `OrderCreatedEvent`.
3. For each `item` in `payload.items`:
   - `catalogService.decrementStock(item.productId, item.quantity)`
4. Log completion.

**Why loop per line item?** Orders can have multiple products. Each decrement is independent; one failure could be logged per product (current code logs warning inside `decrementStock` if insufficient stock).

**Why call CatalogService instead of updating stock directly?**

Inventory does not own the `products` table — Catalog does. Even as a consumer, cross-module writes must go through the owning module's API. This keeps cache invalidation (`redis.del` on product key) in one place.

**Why not give Inventory its own `inventory.stock` table?** That would be a valid microservices split (inventory service owns stock ledger). In this monolith demo, Catalog owns product master data including `stock` column. Inventory is a **reaction** to orders, not a separate stock domain.

---

## How it connects to RabbitMQ

```typescript
@RabbitSubscribe({
  exchange: 'domain_events',
  routingKey: 'order.created',
  queue: 'inventory.order_created',
  queueOptions: { durable: true },
})
```

**Why its own queue name?** Notifications has `notifications.order_created` on the same routing key. Topic exchange **fans out** one publish to many queues. Inventory and Notifications process independently — slow email does not block stock updates.

**Why durable queue?** Messages survive broker restart. Orders placed just before a crash are not silently lost (assuming messages were persisted).

**Why same process as the API?** Operational simplicity. The consumer is a NestJS provider discovered at boot (`enableControllerDiscovery: true` in `rabbitmq.module.ts`). Extracting to a separate container is a deployment change — the handler code stays the same.

---

## What you'll see in logs

After `POST /orders`:

```
[EventBus] Publishing "order.created" -> domain_events
[OrderingService] Order <id> placed by user <id>, total ...
[InventoryConsumer] Reducing stock for order <id> (N line item(s))
[CatalogService] Decremented stock for product <id> by <qty>
[InventoryConsumer] Stock reduction complete for order <id>
```

These lines appear **after** the HTTP response was already sent to the client.

---

## Tradeoff: eventual consistency on stock

Ordering commits before Inventory decrements. Between those two moments, `stock` in Catalog still shows pre-order levels. A second customer could theoretically order the last unit.

**Why accept this in the demo?** Teaches event-driven decoupling first. **Production fixes:**
- Optimistic reservation during checkout transaction
- `decrementStock` failure triggers `order.cancelled` compensation saga
- Idempotent consumer (same `orderId` processed once)

---

## Key files

| File | What it does |
|------|--------------|
| `inventory.consumer.ts` | `@RabbitSubscribe` handler |
| `inventory.module.ts` | Imports `CatalogModule` for `CatalogService` |
