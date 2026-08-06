# Modules: How They Work Together and Why They're Split This Way

A **module** in this codebase is a business capability — not a technical folder like `controllers/` or `utils/`. Each module owns a slice of the domain end-to-end: HTTP surface (if any), business logic, database tables, and optionally event consumers.

---

## Why modules instead of layers?

In a layered monolith, "the checkout feature" is scattered across `OrderController`, `OrderService`, `EmailHelper`, and `InventoryUtil`. No single place owns checkout. Boundaries erode because nothing stops `EmailHelper` from importing `OrderService` from importing `CatalogRepository`.

Here, **Ordering** is one folder. Everything about placing an order lives there. If you need to change checkout behavior, you start in `modules/ordering/`. If you need to change how emails work, you go to `modules/notifications/` — and Ordering does not need to change.

---

## The two ways modules talk to each other

### Synchronous: exported service methods

When module A needs an **immediate answer** from module B, A calls a method on B's exported service.

**Example:** Basket calls `CatalogService.getProductForOrder(id)` to get the current price before showing the cart total.

**Why sync here?** The user is waiting for the basket response. You cannot answer "what does my cart cost?" without knowing prices *now*. Events would force the user to poll or wait — wrong tool for the job.

**Rule:** Only call **exported services**. Never inject another module's TypeORM repository or import its entities for queries.

### Asynchronous: domain events via RabbitMQ

When module A needs to tell the system "something happened" and **does not need to wait** for reactions, A publishes an event.

**Example:** Ordering publishes `order.created` after committing the order. Inventory and Notifications react independently.

**Why async here?** Stock updates and emails are side effects. The customer already got their `{ success, orderId }` response. Making them wait for email delivery would be a latency and reliability bug.

**Rule:** The publisher does not import subscribers. Ordering has zero imports from `inventory/` or `notifications/`.

---

## Module roles in the checkout flow

```
Customer
   │
   ├─► Identity ── issues JWT used by Basket and Ordering
   │
   ├─► Catalog ── product list + prices (Basket reads via CatalogService)
   │
   ├─► Basket ── stores cart lines (productId + quantity only)
   │
   └─► Ordering ── snapshots basket → order, publishes event
            │
            ├──► Inventory (consumer) ── decrements stock via CatalogService
            └──► Notifications (consumer) ── simulated receipt email
```

---

## HTTP modules vs consumer-only modules

| Module | Has HTTP? | Why |
|--------|-----------|-----|
| Identity, Catalog, Basket, Ordering | Yes | Customer-facing operations need a REST API |
| Inventory, Notifications | No | Background reactions to events — no user clicks "decrement stock" |

Consumer-only modules are **not** "helpers" or "workers" tucked in a `jobs/` folder. They are first-class modules with the same boundary rules. The only difference is their trigger (RabbitMQ message instead of HTTP request).

**Why keep them in the same process?** Operational simplicity for a demo and for early-stage products. The code is already structured so you can move `inventory.consumer.ts` to a separate repo and run it as its own container — it only needs RabbitMQ URL and `CatalogService` access (or its own DB write path).

---

## What each module owns

| Module | Owns | Does NOT own |
|--------|------|--------------|
| [Identity](./identity/README.md) | Users, passwords, JWT, sessions | Orders, products |
| [Catalog](./catalog/README.md) | Products, categories, stock levels, product cache | Cart state, orders |
| [Basket](./basket/README.md) | Cart line items per user | Product master data, order records |
| [Ordering](./ordering/README.md) | Orders, order lines, order events | Sending email, decrementing stock |
| [Inventory](./inventory/README.md) | Reacting to `order.created` for stock | HTTP API, order creation |
| [Notifications](./notifications/README.md) | Reacting to `order.created` for email | HTTP API, order creation |

---

## How to add a new module without breaking boundaries

1. Create `src/modules/<name>/` with entity in schema `<name>`.
2. Add a migration — never use `synchronize: true`.
3. Export **one service** (or none if consumer-only).
4. Register in `app.module.ts`.
5. Need to react to something another module did? Subscribe to their event — do not import their service for write-side effects.
6. Need data from another module synchronously? Call their exported read method — do not query their tables.

---

## Naming: doc terminology vs this repo

| Generic / textbook | This repo |
|--------------------|-----------|
| auth | identity |
| cart | basket |
| orders | ordering |

The concepts are identical; the E-Shop naming matches the diagram in the original design material.
