# Oja Marketplace — Capstone

A single NestJS modular monolith that combines the three concepts from `doc.md` into one
coherent, runnable system: **modular monolith architecture** (project 01), **database sharding**
(project 02), and **async queue processing** (project 03). One codebase, one Docker image,
two horizontally-scaled replicas behind Nginx, one sharded data layer for Users/Wallet, one
unsharded primary for everything else, one RabbitMQ event bus feeding four independent
background workers.

This is **not** microservices. It's one repository, one `docker build`, one deployable artifact
run twice — exactly the point `doc.md` makes about Shopify-style modular monoliths.

## Architecture

This mirrors doc.md's final combined-system diagram exactly, with Cloudflare called out as
explicitly out of scope for local dev:

```
                                User
                                  │
                                  ▼
                    Cloudflare (CDN) — OUT OF SCOPE for local dev.
                    In production this would sit in front of Nginx for
                    edge caching/DDoS protection; it adds nothing you can
                    observe on localhost, so it's omitted here. Nginx
                    below is the load balancer this repo actually runs.
                                  │
                                  ▼
                       Nginx Load Balancer (:8080)
                        round-robin, /health passthrough
                                  │
                  ┌───────────────┴───────────────┐
                  ▼                                ▼
            API Server 1                     API Server 2
         (same image, INSTANCE_ID=api-1)  (same image, INSTANCE_ID=api-2)
                  │                                │
                  │        Both replicas run the same modules:        │
                  │  Auth · User · Marketplace · Order · Wallet ·     │
                  │  Notification (+ Email/Inventory/Analytics/Wallet │
                  │  workers, in-process, on both replicas)           │
                  └───────────────┬───────────────┘
                                  │
                ┌─────────────────┼──────────────────┐
                ▼                 ▼                  ▼
      PostgreSQL PRIMARY   Sharded PostgreSQL    Redis (cache & sessions)
      Marketplace/Orders/  (hash(userId) % 3)     product-list cache-aside
      Notifications +      ┌─────┬─────┬─────┐
      email→shard          │  0  │  1  │  2  │  Users + Wallets ONLY
      directory             └─────┴─────┴─────┘  (see "Why only shard
                                                    Users/Wallet" below)
                                  │
                     Customer places an order (POST /orders)
                                  │
                                  ▼
                    Save Order (PostgreSQL primary, transaction)
                                  │
                                  ▼
                    Publish "order.created" ──────► RabbitMQ
                                  │                  (topic exchange
                                  ▼                   `domain_events`)
                    Return { success: true, orderId }
                    to the client — a few hundred ms,
                    NOT waiting on anything below
                                  │
              ┌───────────┬───────────────┬───────────────┐
              ▼           ▼               ▼               ▼
          Email        Inventory      Analytics         Wallet
          Worker        Worker          Worker         Settlement
       (send receipt) (decrement    (record sale)    Worker (debit the
                        stock via                    correct SHARD via
                        Marketplace)                 ShardRouterService)
```

### Oja's module list (per doc.md's "if you were building Oja or Skoo today")

```
API
 ├── Auth Module           — register/login, JWT, bcrypt
 ├── User Module            — sharded profile CRUD
 ├── Marketplace Module     — products/categories, Redis cache-aside   (Catalog, renamed)
 ├── Order Module           — validate → persist → publish order.created
 ├── Wallet Module          — balance + ledger, colocated with User's shard
 └── Notification Module    — Email/Inventory/Analytics/Wallet workers, bound to order.created
```

`School`, `Payment`, `Chat`, and `Admin` are named in doc.md's proposal but intentionally **not
built** here — they would follow the exact same pattern (a module with a controller/service/
entities, talking to others only through public methods or published events), and adding them
would demonstrate nothing new for this capstone. Building a demo of every module the doc
mentions is scope creep, not thoroughness.

## Infra → doc.md concept → sibling project

| Infra piece | doc.md concept it demonstrates | Sibling project that shows it in isolation |
|---|---|---|
| Nginx (`nginx.conf`, port 8080) | "Nginx Load Balancer" in the final combined diagram; round-robin across stateless replicas | *(new to this capstone — no sibling project stands this up)* |
| `api-1` / `api-2` (same image) | "API Server 1 / API Server 2" — one codebase, two replicas, no shared in-process state | `01-modular-monolith` — module boundaries (Catalog/Basket/Ordering/Identity ↔ Auth/User/Marketplace/Order/Wallet/Notification here) |
| `postgres-primary` | "Every module stores its data" — Marketplace/Orders/Notifications on one well-indexed Postgres, per doc.md's explicit sharding guidance | `01-modular-monolith` — schema-per-module Postgres |
| `postgres-shard-0/1/2` | "Real Example: Your Oja Marketplace" — shard Users (and Wallet) by `hash(userId) % 3` | `02-database-sharding` — hash-sharding strategy, shard router |
| `redis` | "Redis (Cache & Sessions)" — cache-aside on `GET /marketplace/products` | `01-modular-monolith` — Redis cache-aside |
| `rabbitmq` + 4 workers | "RabbitMQ at the Bottom" / "Publish order.created → Email/Inventory/Analytics/Notifications Workers" | `03-async-queue-processing` — topic exchange, retry/DLQ via dead-letter-exchange |

## Why only Users/Wallet are sharded (deliberate restraint)

doc.md lays out a 5-stage scaling ladder and is explicit that **most SaaS applications never
reach Stage 5**:

```
Stage 1 — One PostgreSQL database
Stage 2 — Add Redis cache
Stage 3 — Add read replicas
Stage 4 — Partition large tables if needed
Stage 5 — Shard the database         ← most apps never get here
```

This capstone imagines Oja at the point where Users have genuinely outgrown a single database
(doc.md's own worked example: "Imagine Oja grows to 100 million users... you could shard by
userId"). Marketplace and Orders have **not** outgrown anything — a well-indexed products table
with a few thousand or even a few million rows, and an orders table with a foreign-key-free
`user_id` column, is Stage 1-2 territory. Sharding them anyway would mean:

- Losing the ability to `JOIN` orders against products in a single query.
- Needing scatter-gather for anything resembling "top selling products" analytics.
- Adding operational complexity (3x the migrations, 3x the connections, 3x the failure modes)
  for zero benefit at this scale.

So: **Users and Wallet are sharded by `hash(userId) % 3`. Marketplace, Orders, and the
Notification/worker bookkeeping stay on one primary Postgres.** That's the senior-engineer
judgment call doc.md itself argues for — shard the one thing that actually needs it, leave
everything else alone.

### Why Wallet is colocated with User (not sharded independently)

A wallet has no meaning without its owning user, and the two are almost always read/written
together — a profile view shows the balance, and order settlement debits the wallet for a
specific user. Both `User` and `Wallet` are keyed by the same shard function
(`hash(userId) % 3`), so they always land on the same physical Postgres instance. That means
every wallet operation is a normal single-database ACID transaction; a wallet sharded
independently would need a distributed transaction (2PC/saga) just to debit a user's own
balance, for no actual gain.

### The email → shard lookup (a real distributed-systems judgment call)

Login only has an email, not a userId — but the shard key is `hash(userId) % 3`, not
`hash(email)`. Something has to answer "which shard is this email's user on?" before any shard
can be queried. Two options were on the table:

1. **Redis** — fast, but a cache is allowed to be evicted/cold, and this mapping isn't
   reconstructible from anywhere else (you'd have to guess the shard, which defeats the point).
2. **A small unsharded lookup table (`user_directory`) on the primary Postgres** — durable, ACID
   within itself, and it's exactly the kind of small, low-write-volume table a single Postgres
   instance handles without breaking a sweat.

**This project uses option 2.** The tradeoff, made explicit: registration now does two writes to
two different databases (the shard row, then the directory row) with no distributed transaction
tying them together. `AuthService.register` writes the shard row first, then the directory row,
and **compensates** (deletes the shard row) if the second write fails. The one gap this doesn't
close is a process crash *between* the two writes — production would replace the synchronous
compensating delete with a transactional outbox + reconciliation job. See the comment on
`UserDirectory` (`src/modules/auth/entities/user-directory.entity.ts`) and `AuthService.register`
(`src/modules/auth/auth.service.ts`) for the full reasoning.

## Project layout

```
src/
├── main.ts                        Bootstrap, ValidationPipe, Swagger at /docs
├── app.module.ts                  Wires 4 Postgres connections + every module
├── config/                        Env config (typed, one place)
├── common/                        JwtAuthGuard, @CurrentUser(), JwtPayload
├── sharding/                      HashShardingStrategy + ShardRouterService
│                                   (the ONE place hash(userId) % N is computed)
├── infrastructure/
│   ├── postgres/                  4 DataSources (primary + 3 shards) + migrations
│   ├── redis/                     RedisService (cache-aside)
│   └── rabbitmq/                  EventBusService (publish) + topic exchange config
└── modules/
    ├── auth/                      register/login, UserDirectory (primary DB)
    ├── users/                     sharded profile CRUD
    ├── wallet/                    balance + ledger + order-settlement listener
    ├── marketplace/               products/categories (primary DB), Redis cache-aside
    ├── orders/                    validate → persist → publish order.created
    └── workers/                   Email / Inventory / Analytics RabbitMQ consumers
```

## Running it

Docker wasn't available in the environment this was built in, so `docker compose up` has not
been executed here — the steps below are what you'd run once Docker Desktop is up.

```bash
cd 04-oja-marketplace-capstone
cp .env.example .env

# Start every piece of infra: Nginx, 2 API replicas, primary + 3 shard Postgres,
# Redis, RabbitMQ - all with healthchecks and service_healthy dependencies.
docker compose up -d --build

# Or, for local (non-Docker) development against dockerized infra:
npm install
npm run migration:run     # runs the primary migration, then the same migration
                           # against shard0, shard1 and shard2 independently
npm run start:dev
```

`npm run migration:run` is a convenience script that chains
`migration:run:primary && migration:run:shard0 && migration:run:shard1 && migration:run:shard2`
— each shard keeps its own `migrations` history table, so running the identical migration file
three times against three different databases is expected, not a bug.

## End-to-end walkthrough

Once running (via `docker compose up -d`, hitting Nginx on `:8080`; substitute `:3000` if
running `npm run start:dev` directly against one instance):

```bash
BASE=http://localhost:8080

# 1. Register - generates a userId, hashes it to a shard, writes User+Wallet
#    on that shard, writes the email->shard directory entry on primary, then
#    issues a JWT. Wallet gets a 5,000 (500000 cents) signup bonus so the
#    settlement debit below has something to draw from.
curl -s -X POST $BASE/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"ada@oja.dev","password":"correct horse battery staple","fullName":"Ada Lovelace"}' | tee /tmp/register.json

TOKEN=$(jq -r .accessToken /tmp/register.json)

# 2. Login - resolves the shard via the email->shard directory on primary,
#    then queries exactly one shard database for the user row.
curl -s -X POST $BASE/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"ada@oja.dev","password":"correct horse battery staple"}'

# 3. Browse the marketplace - first call is a Postgres read + Redis populate,
#    every call after that (within 60s) is served straight from Redis.
curl -s $BASE/marketplace/products | jq '.[0]'
PRODUCT_ID=$(curl -s $BASE/marketplace/products | jq -r '.[0].id')

# 4. Check the wallet balance before placing an order.
curl -s $BASE/wallet/me -H "Authorization: Bearer $TOKEN" | jq '.wallet.balanceCents'

# 5. Place an order - validates stock via MarketplaceService, persists
#    Order+OrderItems in a transaction on the PRIMARY db, publishes
#    order.created, and returns immediately. No email/inventory/analytics/
#    wallet work has happened yet at the moment this response arrives.
curl -s -X POST $BASE/orders \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"items\":[{\"productId\":\"$PRODUCT_ID\",\"quantity\":2}]}"
# => { "success": true, "orderId": "..." }

# 6. Give the workers a moment, then check the wallet again - the balance
#    should have dropped by the order total, debited on the correct SHARD.
sleep 1
curl -s $BASE/wallet/me -H "Authorization: Bearer $TOKEN" | jq '.wallet, .ledger[0]'

# 7. Health check - what Nginx/orchestration polls; verifies primary, all
#    3 shards, Redis and RabbitMQ are all reachable from this replica.
curl -s $BASE/health | jq
```

### Observing the distributed pieces

```bash
# Watch both replicas at once. You'll see requests land on whichever replica
# Nginx's round-robin picked (INSTANCE_ID in the log line tells you which),
# and - a beat later, from a SEPARATE line, on whichever replica happened to
# be the one whose consumer picked the message off the queue - the four
# workers reacting to order.created:
docker compose logs -f api-1 api-2

# Expect to see, spread across the two containers:
#   [OrdersService] Order <id> persisted for user <id> - publishing order.created
#   [email-worker] Sending receipt for order <id> to user <id> ...
#   [inventory-worker] Order <id>: decrementing stock for product <id> by 2
#   [analytics-worker] Recorded sale: order <id>, user <id>, 1 line item(s) ...
#   [wallet-worker] Settling order <id> for user <id>
#   [wallet-worker] Debited <n> cents from user <id>'s wallet

# RabbitMQ management UI (queues, message rates, the domain_events exchange):
open http://localhost:15672   # user/pass from .env, default oja/oja_dev_password
```

## Tests

```bash
npm install
npm run build   # tsc via `nest build` - no Docker required
npm test        # pure-logic unit tests - no Docker required
```

Two spec files, no live infra required:

- `src/sharding/shard-router.service.spec.ts` — proves `hash(userId) % 3` is deterministic
  (same id → same shard, every call), reproduces doc.md's own worked example
  (`15 % 3 = 0`, `230 % 3 = 2`, `987 % 3 = 0`, `1500 % 3 = 0`) for numeric ids, and asserts
  User/Wallet colocation (same key → same shard, by construction).
- `src/modules/orders/orders.service.spec.ts` — proves the order flow persists to the (mocked)
  primary DB *before* publishing `order.created` to the (mocked) event bus, that it never calls
  Marketplace's stock-mutating method directly (only the four workers do, reacting to the
  event), and that insufficient stock is rejected before either persistence or publish happens.

## What wasn't verified

Docker was not available in the sandbox this was built in, so `docker compose up`,
the Postgres/Redis/RabbitMQ containers, Nginx round-robin behavior, and the full
register → login → order → worker-settlement flow against real infra were **not**
integration-tested. `npm install`, `npm run build`, `npm run lint`, and `npm test` all pass
cleanly. Everything above is written to be run as-is once Docker Desktop is available.
