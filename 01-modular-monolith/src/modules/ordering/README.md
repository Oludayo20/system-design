# Ordering Module: How It Works and Why

Ordering turns a **basket snapshot** into a **durable order record** and announces `order.created` to the rest of the system. It is the orchestration point of checkout — but it deliberately does **not** send emails or decrement stock itself.

---

## How place-order works (step by step)

`POST /orders` → `OrderingService.placeOrder(userId)`:

### 1. Load and validate basket

```typescript
const basket = await this.basketService.assertNotEmpty(userId);
```

Fails with `400` if the cart has no items. No partial orders from empty carts.

### 2. Persist order in one transaction

Inside `dataSource.transaction()`:

- Create `ordering.orders` with `status: placed`, `total` from basket.
- Create `ordering.order_items` for each line with **snapshotted** fields:
  - `product_id`, `product_name`, `unit_price`, `quantity`, `line_total`

**Why one transaction?** Order header and line items must appear together or not at all. Partial orders (header without lines) would be a data integrity bug.

**Why snapshot `product_name` and `unit_price` on the line item?**

The basket showed **live** catalog prices. The order is a **historical record**. If the laptop price drops tomorrow, order #12345 must still show what the customer paid at checkout. Copying values at write time is the standard pattern for order lines in e-commerce.

### 3. Clear the basket

```typescript
await this.basketService.clear(userId);
```

Runs **after** transaction commits (the `transaction()` callback completed successfully).

**Why after commit?** If the transaction rolled back, the cart should remain so the customer can retry.

### 4. Publish domain event

```typescript
void this.eventBus
  .publish(RoutingKeys.ORDER_CREATED, event)
  .catch((err) => this.logger.error(...));
```

**Why `void` (fire-and-forget)?** The HTTP handler returns `{ success, orderId }` without waiting for Inventory or Notifications. `publish()` itself awaits RabbitMQ acknowledgment, but it is not awaited by the code path that builds the HTTP response — the `void` makes that explicit.

**Why publish after commit, not inside the transaction?**

```
BAD:  BEGIN → INSERT order → PUBLISH event → COMMIT
      Consumer receives event → tries to decrement stock
      Transaction rolls back → order gone, but stock already changed

GOOD: BEGIN → INSERT order → COMMIT → PUBLISH event
      Consumer only sees events for orders that definitely exist
```

This is a fundamental rule for event-driven systems without distributed transactions.

### 5. Return immediately

```typescript
return { success: true, orderId: order.id };
```

Customer sees success in under a second. Email and stock happen in the background.

---

## What goes in the event payload

`OrderCreatedEvent` includes everything consumers need **without calling back**:

```typescript
{
  orderId, userId, total,
  items: [{ productId, productName, quantity, unitPrice }, ...]
}
```

**Why self-contained payload?**

- **Notifications** can print "You bought Laptop × 1 for $1899" without querying Ordering or Catalog.
- **Inventory** can decrement by `productId` + `quantity` without loading the order from Postgres.
- **Future Analytics** can subscribe without new API endpoints on Ordering.

This is what makes consumers extractable to separate microservices: the contract is the message, not shared database access.

---

## How list and get order work

- `GET /orders` — all orders for `userId` from JWT, newest first, with items.
- `GET /orders/:id` — single order; `403` if `order.userId !== current user`.

**Why check ownership on get?** Users must not read other customers' orders by guessing UUIDs.

---

## How cancel works

`POST /orders/:id/cancel`:

1. Load order (with ownership check).
2. If already `cancelled` → return as-is (idempotent).
3. Set `status: cancelled`, save.
4. Publish `order.cancelled` (fire-and-forget).

**Why no consumer for `order.cancelled` in this demo?** Extension point. Production would restock via Inventory consumer or trigger refund workflow. Ordering already publishes the event; adding a subscriber does not require changing Ordering.

**Why only cancel `placed` orders implicitly?** Current code allows cancel from `placed`; shipped orders would need stricter rules — omitted for demo scope.

---

## What Ordering does NOT import

```typescript
// ordering.service.ts imports:
import { BasketService } from '../basket/basket.service';
import { EventBus } from '../../infrastructure/rabbitmq/event-bus.service';

// ordering.service.ts does NOT import:
// InventoryConsumer, NotificationsConsumer, CatalogService
```

**Why?** The anti-pattern this repo avoids:

```
placeOrder() → inventoryService.decrement() → emailService.send() → return response
```

Customer waits for all of it. One failure in email fails checkout. Modules are tangled.

Events invert control: Ordering says "order happened"; others react if they care.

---

## Data model

Schema `ordering`:
- `orders` — `user_id`, `status` (`placed` | `cancelled`), `total`, timestamps
- `order_items` — snapshotted lines; `product_id` is logical reference only (no FK to catalog)

---

## Production gaps (intentional in demo)

| Gap | Why omitted | Production approach |
|-----|-------------|---------------------|
| No outbox table | Simpler code | Transactional outbox: insert event row in same TX as order, separate publisher process |
| No idempotency key | Single-click demo | `Idempotency-Key` header on `POST /orders` |
| No stock reservation | Shows async inventory | Reserve stock in checkout transaction or saga |

---

## Key files

| File | What it does |
|------|--------------|
| `ordering.service.ts` | placeOrder, cancel, list, get — core checkout logic |
| `events/order-created.event.ts` | Event contract shared with consumers |
| `entities/order-item.entity.ts` | Snapshotted line items |
