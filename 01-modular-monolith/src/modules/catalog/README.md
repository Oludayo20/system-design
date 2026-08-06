# Catalog Module: How It Works and Why

Catalog is the **source of truth for products** — names, prices, stock, categories. Every other module that needs product information must go through `CatalogService`, not through Catalog's database tables directly.

---

## How product listing works

`GET /catalog/products` queries Postgres directly and returns all products, newest first.

**Why no cache on the list endpoint?** Product lists change when admins add items or reorder display. Caching lists requires invalidation rules (on any product write, on category change, etc.). This demo caches the **single-product read path** where cache-aside is easy to reason about. The pattern is the lesson; production would add list caching with proper invalidation.

---

## How single-product reads work (cache-aside)

`GET /catalog/products/:id` in `catalog.service.ts#getProduct`:

```
1. Build Redis key: catalog:product:{id}
2. GET from Redis
   ├─ HIT  → return cached product (log: "Cache hit")
   └─ MISS → SELECT from Postgres
              → if not found: 404
              → SET Redis with TTL 300 seconds
              → return product (log: "Cache miss")
```

**Why cache-aside?** The application manages the cache explicitly:
- On read: try cache, fall back to DB, populate cache.
- On write: update DB, invalidate cache.

This is simpler than write-through (every write updates cache) for a read-heavy catalog where writes are rare.

**Why 300-second TTL?** Balances freshness vs hit rate. Even without TTL, stock invalidation on decrement handles the critical consistency case. TTL is a safety net for other field changes (name, price) if invalidation were missed.

**Try it:** Call the same product ID twice. First request logs "Cache miss"; second logs "Cache hit" within 300 seconds.

---

## How other modules read products (`getProductForOrder`)

Basket and Ordering never see the full `Product` entity. They call:

```typescript
getProductForOrder(id): Promise<{ id, name, price, stock }>
```

**Why a narrow return type (`ProductForOrder`)?** Principle of least privilege. Basket only needs name and price to show a cart line. Exposing the full entity (internal fields, relations, future admin metadata) would couple callers to Catalog's schema evolution.

**Why does Basket call this on every `getBasket()`?** Cart rows store only `productId` + `quantity`. Prices are resolved at read time so the customer always sees current catalog prices while browsing — not stale prices from when they added the item.

**When do prices freeze?** At checkout, Ordering copies `unitPrice` and `productName` onto `order_items`. Until then, live catalog prices apply.

---

## How stock decrement works (Inventory path)

Only `decrementStock(id, quantity)` writes stock from outside Catalog. Called by `InventoryConsumer` after `order.created`.

**How:**
1. Run atomic SQL: `UPDATE products SET stock = stock - :qty WHERE id = :id AND stock >= :qty`
2. If zero rows affected → log warning (insufficient stock; order already committed — see tradeoff below)
3. Delete Redis key `catalog:product:{id}` so next read gets fresh stock

**Why atomic UPDATE with `stock >= :qty`?** Prevents negative stock without a separate read-then-write race. Two concurrent decrements cannot both succeed if only one unit remains.

**Why invalidate cache on decrement but not on every admin edit?** This demo only has programmatic stock changes via Inventory. Admin product edits would need the same invalidation — omitted to keep scope small.

**Tradeoff — order committed before stock check:** Ordering does not reserve stock at checkout. Inventory decrements asynchronously. In a high-contention scenario, you could oversell. **Why implemented this way?** Demonstrates event-driven decoupling first. Production would add reservation (hold stock in transaction) or saga compensation (cancel order if decrement fails).

---

## Module boundary enforcement

`catalog.module.ts` exports **only** `CatalogService`. The TypeORM `Repository<Product>` is not exported.

**What this prevents:** Basket importing `Product` entity and running `productsRepository.find()`. That would bypass cache-aside, skip future catalog business rules (e.g. "discontinued products"), and couple Basket to Catalog's table shape.

`basket.cart_items.product_id` has **no foreign key** to `catalog.products`. Validity is enforced in application code: `getProductForOrder()` throws `404` if the product does not exist.

---

## Data model

Schema `catalog`:
- `categories` — grouping for products
- `products` — `name`, `price`, `stock`, `category_id`

Seed migration `1706000000005-SeedCatalogDemoData.ts` inserts demo products so `docker compose up` is immediately testable.

---

## Key files

| File | What it does |
|------|--------------|
| `catalog.service.ts` | List, cache-aside get, `getProductForOrder`, `decrementStock` |
| `catalog.types.ts` | `ProductForOrder` — the public read contract |
| `catalog.module.ts` | Exports `CatalogService` only |
