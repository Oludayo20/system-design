# E-Shop — Modular Monolith Reference Implementation

Project 1 of a 4-part system design series. This one demonstrates the **modular monolith**
pattern: one codebase, one deployment, one repository — but internally organized into modules
with strict boundaries, communicating through **domain events** instead of direct calls.

Think Shopify: a single Rails/Node/whatever app, not a swarm of microservices, but you'd never
know it from how cleanly the code is separated.

## Concept, in my own words

A "monolith" gets a bad reputation because most monoliths are **big balls of mud**: a
`controllers/`, `helpers/`, `services/`, `utils/` soup where every file can call every other file,
and changing checkout code accidentally breaks the search page. That's not what "monolith" has to
mean — it's just what happens when nobody enforces boundaries.

A **modular monolith** takes the same single deployable and slices it into modules that each own
one business area end-to-end (controller, service, repository, entities, events) and are not
allowed to reach into each other's internals. The only sanctioned ways to cross a module boundary
are:

1. A **narrow, exported service method** (e.g. `CatalogService.getProductForOrder(id)`), or
2. A **domain event** published to a shared bus, which other modules may or may not subscribe to.

Nobody imports another module's repository. Nobody runs a SQL join across two modules' tables.
The payoff: you get most of the operational simplicity of a monolith (one process to run, one
transaction manager, one deploy) with most of the structural discipline of microservices — and if
one module (say, Notifications) ever needs to become its own service because it's sending
millions of emails a day, you can cut it out cleanly because its boundary was already a real
boundary, not just a folder name.

## Module map (E-Shop naming -> doc.md naming)

The source doc uses `auth` / `cart` / `orders`; this implementation uses the E-Shop names from the
diagram (`Identity` / `Basket` / `Ordering`) for the same responsibilities. `payments` isn't in the
E-Shop diagram so it's omitted; `inventory` and `notifications` are kept as internal, HTTP-less
event consumers exactly as the diagram shows them ("Inventory Module", "Email Module").

| doc.md module | This repo         | Owns                                              |
|----------------|-------------------|----------------------------------------------------|
| `auth`         | `modules/identity`| Login, Registration, JWT, Roles                    |
| `catalog`      | `modules/catalog` | Products, Categories, cache-aside product reads     |
| `cart`         | `modules/basket`  | Add/Remove item, cart totals                        |
| `orders`       | `modules/ordering`| Place Order, Cancel Order, Order History             |
| `inventory`    | `modules/inventory`| `order.created` consumer -> decrements stock         |
| `notifications`| `modules/notifications`| `order.created` consumer -> simulated receipt email |

## Where every doc.md concept lives

| doc.md concept | Implementation |
|---|---|
| "Still one codebase, one deployment, one repository" | Single `package.json`, single `Dockerfile`, single Nest app bootstrapped in `src/main.ts` |
| Catalog owns Products/Categories/Search/Images | `src/modules/catalog/` (`entities/product.entity.ts`, `entities/category.entity.ts`, `catalog.controller.ts`) |
| Basket owns Add/Remove/Totals/Coupons | `src/modules/basket/` (coupons intentionally out of scope for this demo — noted as a TODO in `basket.service.ts` totals logic) |
| Ordering owns Place/Cancel/History | `src/modules/ordering/` (`ordering.controller.ts`: `POST /orders`, `POST /orders/:id/cancel`, `GET /orders`) |
| Identity owns Login/Registration/JWT/Roles | `src/modules/identity/` (`identity.service.ts`, `entities/user.entity.ts` has a `roles` column, `guards/jwt-auth.guard.ts`) |
| "Modules communicate through events, not direct calls" | `src/infrastructure/rabbitmq/event-bus.service.ts` — `EventBus.publish()`; Ordering never imports Inventory or Notifications at all |
| Bad chain `Ordering -> InventoryService.update() -> EmailService.send() -> Notification.send()` | Explicitly avoided: `ordering.service.ts` has zero imports from `inventory` or `notifications` |
| `OrderCreated` event, "Basket/Catalog/Email don't care unless they subscribe" | `src/infrastructure/rabbitmq/rabbitmq.constants.ts` (`RoutingKeys.ORDER_CREATED`); only `inventory.consumer.ts` and `notifications.consumer.ts` bind queues to it |
| RabbitMQ "at the bottom", async, Ordering -> RabbitMQ -> Inventory -> Email -> Analytics | `src/infrastructure/rabbitmq/rabbitmq.module.ts` declares the `domain_events` topic exchange; `inventory.consumer.ts` and `notifications.consumer.ts` are independent durable-queue subscribers |
| create-order 150ms vs send-email 5s, don't await both | `ordering.service.ts#placeOrder` commits the DB transaction, fires `eventBus.publish()` **without awaiting it**, and returns `{ success, orderId }` immediately; `notifications.consumer.ts` has a literal 5s simulated delay |
| PostgreSQL, "every module stores its data" | One Postgres instance, 4 schemas (see below) |
| "give each module its own schema to strengthen boundaries" | `identity`, `catalog`, `basket`, `ordering` schemas — see `src/infrastructure/postgres/migrations/1706000000000-CreateSchemas.ts` and every `@Entity({ schema: '...' })` |
| Redis: sessions, cache, cart, OTP, rate limiting, frequently-viewed | `src/infrastructure/redis/` used for (a) product cache-aside in `catalog.service.ts`, (b) session tokens in `identity.service.ts`. OTP/rate-limiting/"frequently viewed" are noted as natural extensions of the same `RedisService` but not built out — this demo keeps to the request flow the doc walks through |
| Cache-aside on `/products` | `catalog.service.ts#getProduct`: check Redis -> miss -> read Postgres -> populate Redis with a TTL |
| API is the single entrypoint that routes to modules | `src/main.ts` + Nest's router: `POST /orders` -> `OrderingController`, `GET /catalog/products` -> `CatalogController`, etc, all mounted on one HTTP server |
| Docker: `docker compose up` starts everything | `docker-compose.yml` (postgres, redis, rabbitmq, api) + `Dockerfile` |
| Bad monolith `src/{controllers,helpers,utils,services}` | Deliberately **not** how this repo is organized — see below |
| Good: `src/modules/{catalog,basket,ordering,identity}`, each with own Controllers/Services/Repositories/Entities/Events | `src/modules/*/*.controller.ts`, `*.service.ts`, `entities/`, `events/` |
| "Ordering module cannot directly manipulate Catalog internals. It uses public interfaces or publishes events" | `catalog.module.ts` exports **only** `CatalogService` (not the `Product`/`Category` repositories); `basket.service.ts` and `ordering.service.ts` call `CatalogService.getProductForOrder(id)`, never a repository |
| NestJS target layout (`modules/`, `infrastructure/`, `shared/`, `main.ts`) | Followed directly — see the tree below |
| Request-flow demo (buy a laptop) | Walked through end-to-end in the curl section below |

## "Bad monolith" vs "modular monolith", using this repo

The doc's bad example:

```
src/
├── controllers/
├── helpers/
├── utils/
└── services/
```

Everything is grouped by **technical layer**, so "the checkout logic" is scattered across four
folders, and nothing stops `services/email.ts` from importing `services/orders.ts` importing
`services/catalog.ts` in a tangle. Changing one file risks breaking ten others because there is no
enforced boundary — only convention, which erodes.

This repo groups by **business capability** instead:

```
src/modules/
├── identity/     (own controller, service, entities, guard)
├── catalog/      (own controller, service, entities — exports ONLY CatalogService)
├── basket/       (own controller, service, entities — depends on CatalogService, not catalog's tables)
├── ordering/     (own controller, service, entities, events — depends on BasketService + EventBus, never inventory/notifications)
├── inventory/    (no controller at all — just a queue consumer)
└── notifications/(no controller at all — just a queue consumer)
```

Concretely enforced, not just by convention:

- `CatalogModule` only exports `CatalogService` (see `catalog.module.ts`) — `Product`/`Category`
  repositories are private to the module. Basket and Ordering physically cannot import them.
- `basket/entities/cart-item.entity.ts` and `ordering/entities/order-item.entity.ts` both store a
  bare `product_id` UUID with **no TypeORM relation and no foreign key** into `catalog.products` —
  see the comments in those files. Basket/Ordering ask Catalog for product data through
  `CatalogService.getProductForOrder()`, they never query or join Catalog's table.
- `ordering.service.ts` has no import of `inventory` or `notifications` at all. It publishes
  `order.created` and moves on — it has no idea those modules exist.

## Full NestJS layout

```
src/
├── modules/
│   ├── identity/        (auth.controller/service equivalent — register, login, JWT, roles)
│   │   ├── entities/user.entity.ts
│   │   ├── guards/jwt-auth.guard.ts
│   │   ├── strategies/jwt.strategy.ts
│   │   └── dto/
│   ├── catalog/
│   │   ├── entities/{product,category}.entity.ts
│   │   └── catalog.types.ts        (narrow ProductForOrder contract)
│   ├── basket/
│   │   └── entities/cart-item.entity.ts
│   ├── ordering/
│   │   ├── entities/{order,order-item}.entity.ts
│   │   └── events/order-created.event.ts
│   ├── inventory/
│   │   └── inventory.consumer.ts   (order.created -> decrement stock)
│   └── notifications/
│       └── notifications.consumer.ts (order.created -> simulated email, 5s)
│
├── infrastructure/
│   ├── postgres/
│   │   ├── data-source.ts          (TypeORM CLI config)
│   │   └── migrations/             (schemas, tables, seed data — no synchronize:true)
│   ├── redis/
│   │   ├── redis.module.ts
│   │   └── redis.service.ts
│   └── rabbitmq/
│       ├── rabbitmq.module.ts      (declares the `domain_events` topic exchange)
│       ├── event-bus.service.ts    (typed publish())
│       └── rabbitmq.constants.ts   (routing keys, envelope shape)
│
├── shared/
│   └── decorators/current-user.decorator.ts
│
├── app.module.ts
└── main.ts
```

## Companies known to use this pattern

- **Shopify** — explicitly named in the source material; its Rails monolith is organized into
  "components" (their term for modules) with enforced boundaries, and it still runs a huge share
  of Shopify's core commerce platform as one deployable.
- **GitHub** — ran (and largely still runs) as a modular Rails monolith rather than microservices.
- **Basecamp / 37signals** — publicly advocate for "majestic monolith" architecture.
- **StackOverflow** — famously scaled a monolith (not modularized the same way, but the same
  "you don't need microservices to scale" lesson applies).

## Running it

> **Hosting & deployment:** See [HOSTING.md](./HOSTING.md) for Docker setup, platforms (free → paid), production tooling, and per-component checklists.

### Prerequisites

- Docker + Docker Compose (recommended path), **or** Node 20+, PostgreSQL 16, Redis 7, RabbitMQ 3
  running locally.

### Option A — Docker Compose (everything)

```bash
cp .env.example .env
docker compose up --build
```

This starts Postgres, Redis, RabbitMQ (management UI on http://localhost:15672,
`eshop` / `eshop_dev_password` by default), runs migrations, then starts the API on
http://localhost:3000 (Swagger docs at http://localhost:3000/docs).

### Option B — Local Node, infra in Docker

```bash
cp .env.example .env
docker compose up -d postgres redis rabbitmq
npm install
npm run migration:run
npm run start:dev
```

### Useful scripts

```bash
npm run build              # tsc build (nest build)
npm run start:dev          # watch mode
npm run test                # unit tests
npm run lint                 # eslint
npm run migration:generate -- src/infrastructure/postgres/migrations/SomeName
npm run migration:run
npm run migration:revert
```

## Curl walkthrough

The seed migration creates 5 demo products (a laptop, mouse, keyboard, headphones, monitor) across
3 categories, so you can run this immediately after `docker compose up`.

```bash
BASE=http://localhost:3000

# 1. Register
curl -s -X POST $BASE/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"jane@example.com","password":"S3curePassword!","fullName":"Jane Doe"}' | tee /tmp/register.json

TOKEN=$(node -p "require('/tmp/register.json').accessToken")

# 2. (or) Login instead of register on subsequent runs
curl -s -X POST $BASE/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"jane@example.com","password":"S3curePassword!"}'

# 3. Browse products (Catalog module; GET /catalog/products/:id is Redis cache-aside)
curl -s $BASE/catalog/products | tee /tmp/products.json
LAPTOP_ID=$(node -p "require('/tmp/products.json').find(p => p.name.startsWith('Laptop')).id")

curl -s $BASE/catalog/products/$LAPTOP_ID   # first call: Postgres, populates Redis
curl -s $BASE/catalog/products/$LAPTOP_ID   # second call: served from Redis (check logs for "Cache hit")

# 4. Add to basket (Basket module; resolves price via CatalogService, not Catalog's table)
curl -s -X POST $BASE/basket/items \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"productId\":\"$LAPTOP_ID\",\"quantity\":1}"

curl -s $BASE/basket -H "Authorization: Bearer $TOKEN"

# 5. Place the order — note the response, and note the timestamp
date +%s%3N
curl -s -X POST $BASE/orders -H "Authorization: Bearer $TOKEN"
date +%s%3N
```

You'll see `{"success":true,"orderId":"..."}` come back in well under a second — the order is
already committed to Postgres and `order.created` has already been published. Watch the API logs
(`docker compose logs -f api`) and you'll see, independently and asynchronously:

```
[InventoryConsumer] Reducing stock for order <id> (1 line item(s))
[InventoryConsumer] Decremented stock for product <id> by 1
[InventoryConsumer] Stock reduction complete for order <id>
[NotificationsConsumer] Sending receipt email for order <id> to user <id> (simulated, ~5s)...
...about 5 seconds later...
[NotificationsConsumer] Receipt email sent for order <id>, total $1899.00
```

The HTTP response returned before the notification log line even started — that's the whole
point: create-order is fast, send-email is slow, and the customer never waits on the slow part.

```bash
# 6. Order history / detail
curl -s $BASE/orders -H "Authorization: Bearer $TOKEN"
curl -s $BASE/orders/<orderId> -H "Authorization: Bearer $TOKEN"
```

## Notes on the implementation

- **No `synchronize: true`.** Schema is entirely migration-driven
  (`src/infrastructure/postgres/migrations`), which is what you'd actually ship.
- **Event publish happens after commit, not before** (`ordering.service.ts`): publishing before
  the transaction commits risks a consumer reacting to an order a later rollback erases.
- **Event publish is fire-and-forget** relative to the HTTP response: the controller returns as
  soon as the order is saved; `EventBus.publish()` is invoked but not awaited by the response
  path, matching the "API responds almost instantly" behavior in the doc.
- **RabbitMQ topology as code**: the `domain_events` topic exchange and every consumer's durable
  queue + binding are declared declaratively via `@golevelup/nestjs-rabbitmq`
  (`rabbitmq.module.ts`, `@RabbitSubscribe` in the Inventory/Notifications consumers) rather than
  configured by hand in the RabbitMQ UI.
- Docker was not available in the sandbox this was built in, so the compose stack could not be
  integration-tested end-to-end. It was validated by careful reading plus `npm run build` /
  `npx tsc --noEmit` passing cleanly — see the project notes for what to double-check on first
  real `docker compose up`.
