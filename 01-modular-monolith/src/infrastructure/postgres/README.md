# PostgreSQL: How It Works and Why

This app uses **one PostgreSQL database** with **four schemas** — one per HTTP-facing module. Migrations are the only way schema changes ship; TypeORM `synchronize` is disabled everywhere.

---

## Why schema-per-module instead of one `public` schema?

In a typical monolith, all tables live in `public` and foreign keys cross every boundary:

```sql
-- Tempting but couples modules at the DB layer
ALTER TABLE basket.cart_items
  ADD FOREIGN KEY (product_id) REFERENCES catalog.products(id);
```

Once that FK exists:
- Basket migrations break if Catalog renames a column
- Developers write `JOIN catalog.products` in Basket queries
- "Modules" become folders, not boundaries

**This repo uses separate schemas** (`identity`, `catalog`, `basket`, `ordering`) with **no cross-schema foreign keys**. Modules reference each other by UUID in application code and validate through service calls.

**Why not separate databases per module?** Checkout needs basket read + order write in one logical operation. Separate DBs require distributed transactions (2PC) or sagas for day-one checkout. One database keeps `dataSource.transaction()` simple while schemas still document ownership.

---

## How migrations run

### At development time

```bash
npm run migration:run    # apply pending
npm run migration:revert # undo last
```

Uses `data-source.ts` — loads `.env` when `NODE_ENV !== 'production'`.

### In Docker

```bash
typeorm migration:run -d dist/infrastructure/postgres/data-source.js
node dist/main.js
```

**Why two config paths (`app.module.ts` and `data-source.ts`)?**

- **Runtime app** uses `ConfigService` (Nest injection, testable).
- **CLI** runs outside Nest — needs standalone `DataSource` with `process.env`.

Both must agree on host, user, password, database. Change one, change both.

**Why `synchronize: false`?**

`synchronize: true` auto-alters tables from entities on boot. Dangerous in production:
- Unreviewed schema changes deploy with code
- Data loss risk on column type changes
- No rollback story

Migrations are versioned, reviewable, and reversible.

---

## Migration order and what each does

| Migration | What happens |
|-----------|--------------|
| `CreateSchemas` | `uuid-ossp` extension + four schemas |
| `CreateIdentityUsersTable` | `identity.users` |
| `CreateCatalogTables` | `categories`, `products` |
| `CreateBasketCartItemsTable` | `cart_items` with unique (user, product) |
| `CreateOrderingTables` | `orders`, `order_items`, status enum |
| `SeedCatalogDemoData` | 5 products for immediate curl testing |

**Why seed in migration?** Demo repo should work after `docker compose up` without manual SQL. Production would use a separate seed job or admin import.

---

## How TypeORM finds entities

- **Runtime:** `autoLoadEntities: true` + each module's `TypeOrmModule.forFeature([Entity])`.
- **CLI:** glob `modules/**/*.entity.ts` in `data-source.ts`.

Every entity declares `@Entity({ schema: 'catalog', name: 'products' })` — schema is explicit, not default `public`.

---

## How transactions work at checkout

`OrderingService.placeOrder()` uses:

```typescript
await this.dataSource.transaction(async (manager) => {
  // insert order + items with same manager
});
```

**Why `DataSource.transaction` not `@Transactional()` decorator?** Explicit control in one method. All order inserts share one connection and commit atomically.

Basket clear runs **outside** this transaction — after success. If transaction fails, cart is untouched.

---

## Intentional absence of foreign keys

`basket.cart_items.product_id` → no FK to `catalog.products`  
`ordering.order_items.product_id` → no FK to `catalog.products`  
`basket.cart_items.user_id` → no FK to `identity.users`

**How integrity is enforced instead:**

| Reference | Enforced by |
|-----------|-------------|
| product_id | `CatalogService.getProductForOrder()` before cart add / at basket read |
| user_id | JWT on every authenticated request |

**Tradeoff:** Orphan UUIDs possible if admin deletes a product while it's in someone's cart. Production would handle "product discontinued" in Catalog API or soft-delete products.

---

## Operations notes

- Inspect: `psql` → `\dn` (schemas), `\dt catalog.*` (tables)
- Backup: `pg_dump` of database `eshop`
- Scale reads: read replica for Catalog list/get (application-level routing)
