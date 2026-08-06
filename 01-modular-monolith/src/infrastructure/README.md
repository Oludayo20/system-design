# Infrastructure: How It Works and Why

Infrastructure folders contain **adapters** to external systems — Postgres, Redis, RabbitMQ. Feature modules talk to infrastructure through thin services (`RedisService`, `EventBus`), not raw drivers.

**Why separate infrastructure from modules?** Business rules belong in `modules/`. "How we connect to Redis" is a technical concern that might change (switch from ioredis to another client, change connection pooling) without touching Identity or Catalog logic.

---

## How the three systems divide responsibility

| System | What it stores | Why this tier |
|--------|----------------|---------------|
| **PostgreSQL** | Durable business data (users, products, carts, orders) | ACID transactions, source of truth, queryable history |
| **Redis** | Ephemeral / fast-read data (sessions, product cache) | Sub-millisecond reads; data that can be rebuilt from Postgres |
| **RabbitMQ** | In-flight domain events | Decouple publishers from subscribers in time and failure domains |

None replaces another. Postgres without Redis works but every product read hits disk. Postgres without RabbitMQ works but checkout blocks on email. Each addition solves a specific problem.

---

## How modules access infrastructure

```
Feature module (e.g. Catalog)
        │
        ├──► CatalogService uses RedisService (injected)
        ├──► TypeORM repositories (configured in app.module.ts)
        └──► OrderingService uses EventBus (injected)

Feature module does NOT:
        ├──► import ioredis
        ├──► import amqplib
        └──► open raw pg connections
```

**Why global modules for Redis and RabbitMQ?** `@Global()` on `RedisModule` and `RabbitmqModule` means any module can inject `RedisService` or `EventBus` without importing infrastructure in every `*.module.ts`. Postgres uses Nest's `TypeOrmModule.forRootAsync` once in `app.module.ts`.

---

## How Docker Compose wires it

From `docker-compose.yml`:

1. **postgres**, **redis**, **rabbitmq** start with healthchecks.
2. **api** waits for all three healthy, then:
   - Waits for Postgres DNS/TCP (extra guard for race on first boot).
   - Runs `migration:run`.
   - Starts `node dist/main.js`.

**Why migrations before app start?** The API assumes tables exist. `synchronize: false` means TypeORM will not auto-create schema — migrations are the only path.

**Why not run migrations in a separate init container?** Single `api` command keeps local dev simple. Production often uses a dedicated migration job; the principle is the same: schema before traffic.

---

## Deep dives

| Component | README |
|-----------|--------|
| [PostgreSQL & migrations](./postgres/README.md) | Schema-per-module, why no synchronize, migration workflow |
| [Redis](./redis/README.md) | Cache-aside, session keys, why wrapper service |
| [RabbitMQ](./rabbitmq/README.md) | Event bus, envelope, fan-out, fire-and-forget |

---

## Design principle: infrastructure is dumb

`RedisService` has `get`, `set`, `setJson` — no `cacheProduct()` method. `EventBus` has `publish()` — no `publishOrderCreated()`.

**Why keep infrastructure generic?** Domain language (`cacheProduct`, `orderCreated`) belongs in module services. Infrastructure provides capabilities; modules apply business meaning. That way RabbitMQ could be replaced with SNS/SQS and only `rabbitmq/` changes.
