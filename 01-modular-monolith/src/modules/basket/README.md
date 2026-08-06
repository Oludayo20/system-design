# Basket Module: How It Works and Why

Basket is the **shopping cart** — it remembers what a logged-in user intends to buy (product IDs and quantities) until they check out or remove items. It does not own product data or orders.

---

## How add-to-basket works

`POST /basket/items` with `{ productId, quantity }`:

1. `CatalogService.getProductForOrder(productId)` — validates the product exists and is priceable. If not → propagates Catalog's `404`.
2. Look up existing `cart_items` row for `(userId, productId)`.
3. If exists → increment `quantity`. If not → insert new row.
4. Return full basket view via `getBasket()`.

**Why validate via Catalog before insert?** Basket must not store references to non-existent products. Without this call, a client could add arbitrary UUIDs and only fail at checkout — worse UX and messier error handling.

**Why merge quantity on duplicate add?** Standard e-commerce behavior. One row per `(user, product)` keeps the table small and queries simple. Unique constraint `uq_cart_items_user_product` enforces this at DB level.

---

## How get-basket works

`GET /basket`:

1. Load all `cart_items` for the authenticated `userId`.
2. For **each** line, call `CatalogService.getProductForOrder(productId)`.
3. Build response lines: `{ productId, name, unitPrice, quantity, lineTotal }`.
4. Sum `lineTotal` into `total`.

**Why re-fetch catalog data on every read instead of storing name/price in the cart table?**

| Approach | Pros | Cons |
|----------|------|------|
| Store price in cart | Fewer Catalog calls | Stale prices if admin changes price; duplicate source of truth |
| Fetch live from Catalog (this repo) | Always correct current price | N Catalog calls per basket view |

For a browsing cart, **live prices are correct**. The customer should see today's price, not the price from when they added the item three days ago. Prices freeze at **order placement** (Ordering's job), not at add-to-cart.

**Why N calls is acceptable here?** Typical carts have few items. At scale, you'd batch `getProductForOrder` or add a `getProductsForOrder(ids[])` to Catalog — still through the service, not direct SQL.

---

## How remove and clear work

- `DELETE /basket/items/:productId` — deletes one line, returns updated basket.
- `clear(userId)` — deletes all lines for user. Called by Ordering **after** successful order commit.

**Why clear after commit, not before?** If you cleared before the transaction and the transaction failed, the customer loses their cart. Clear only when the order is durable.

---

## What Basket stores vs what it does not

**Stores in `basket.cart_items`:**
- `user_id` (from JWT)
- `product_id` (UUID only)
- `quantity`

**Does not store:**
- Product name, price, image — comes from Catalog at read time
- Order ID — Ordering's domain

**Why no FK from `product_id` to `catalog.products`?**

This is intentional module isolation. A foreign key would mean:
- Basket migrations depend on Catalog's table existing with a specific shape
- Database-level coupling that encourages JOINs across module boundaries

Instead, the **application** enforces referential integrity via `getProductForOrder()`. The comment in `cart-item.entity.ts` documents this decision for future maintainers.

**Why no FK from `user_id` to `identity.users`?** Same pattern. Identity and Basket are separate modules. The JWT guarantees `userId` is valid at request time; Basket does not need to verify the user row exists on every cart operation.

---

## How Ordering uses Basket

`OrderingService.placeOrder()`:

1. `assertNotEmpty(userId)` — throws `400 Basket is empty` if no lines.
2. `getBasket(userId)` is effectively called inside assert (assert loads and checks length).
3. After order commit → `clear(userId)`.

**Why does Ordering depend on BasketService synchronously?** Checkout is one atomic user action: "turn my cart into an order." The order snapshot must reflect the current cart *now*. Async cart-to-order would require the user to wait for a second step or poll — poor UX.

---

## Authentication

All basket routes require `JwtAuthGuard`. Cart is per-user; there is no anonymous cart in this demo.

**Why JWT-scoped cart?** Simplifies the model — `user_id` on every row. Guest carts (Redis session cookie) would be a natural extension without changing module boundaries.

---

## Key files

| File | What it does |
|------|--------------|
| `basket.service.ts` | addItem, removeItem, getBasket, clear, assertNotEmpty |
| `entities/cart-item.entity.ts` | Minimal persistence; documents no cross-schema FK |
| `basket.types.ts` | `BasketView` — priced response shape for API |
