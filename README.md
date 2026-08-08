# System Design — from doc.md to running code

`doc.md` is a chat transcript covering system design concepts from modular monoliths through
internet-scale resilience and CAP tradeoffs. This repo turns each one into a real, runnable
project, then combines the first three into a capstone. Every project uses PostgreSQL in Docker
and the same tools the doc names for production use (RabbitMQ, Redis, Kafka, Nginx), built with
NestJS/TypeScript and TypeORM the way an engineering team would actually ship it.

| # | Project | Concept in doc.md | Stack |
|---|---------|--------------------|-------|
| 1 | [`01-modular-monolith`](./01-modular-monolith) | Modular monolith architecture (Catalog/Basket/Ordering/Identity, single repo, single deploy, event-driven module boundaries) | NestJS, PostgreSQL, Redis, RabbitMQ, Docker Compose |
| 2 | [`02-database-sharding`](./02-database-sharding) | Sharding a database by key (range / hash / geo), shard routing, sharding vs replication | NestJS, 3× PostgreSQL shards, Docker Compose |
| 3 | [`03-async-queue-processing`](./03-async-queue-processing) | Producer/queue/consumer, RabbitMQ vs Kafka, retries & dead-letter queues, traffic-spike absorption | NestJS, PostgreSQL, RabbitMQ, Kafka, Docker Compose |
| 4 | [`04-oja-marketplace-capstone`](./04-oja-marketplace-capstone) | Everything above combined into the "Oja/Skoo" architecture from the end of doc.md | NestJS (modular monolith), Nginx load balancer, 2 API replicas, sharded Postgres, Redis, RabbitMQ workers, Docker Compose |
| 5 | [`05-resilience`](./05-resilience) | **Level 6:** retries, circuit breakers, provider fallback, graceful degradation | NestJS (in-memory flaky payment demo) |
| 6 | [`06-cap-theorem`](./06-cap-theorem) | **Level 7:** CAP tradeoffs — AP product views vs CP wallet debits, partition simulation | NestJS (in-memory two-node cluster) |
| 7 | [`07-monolithic-architecture`](./07-monolithic-architecture) | Plain monolith ("BlogStack") — one codebase, one deploy, shared DB, modules calling each other's services directly with no enforced boundaries. Contrast with project 01's enforced event-driven boundaries | NestJS, PostgreSQL, Docker Compose |
| 8 | [`08-microservices-architecture`](./08-microservices-architecture) | Microservices ("BookHive") — API gateway + 4 independently deployable/scalable services, each owning its own PostgreSQL database, talking over HTTP, with fault isolation and independent redeploys | Express gateway, NestJS/Express services, 3× PostgreSQL, Docker Compose |
| 9 | [`09-event-driven-architecture`](./09-event-driven-architecture) | Event-driven pub/sub ("FreshCart") — one `OrderPlaced` event fanning out to 4 independent consumers, loose coupling (add a consumer with zero producer changes), publish-after-commit, idempotent duplicate handling | NestJS producer + 4 consumers, PostgreSQL, RabbitMQ, Docker Compose |
| 10 | [`10-serverless-architecture`](./10-serverless-architecture) | Serverless / FaaS — hand-built local Lambda-style emulator with real measured cold vs warm starts, TTL-based scale-to-zero, per-invocation billing, and HTTP/schedule/queue/file-drop triggers | Node/TypeScript custom runtime, RabbitMQ, Docker Compose |
| 11 | [`11-layered-architecture`](./11-layered-architecture) | Layered / N-Tier ("Riverside Library") — Presentation → Application → Domain → Data Access → Database, with a framework-free Domain layer and business rules unit-tested with zero DB | NestJS, TypeORM, PostgreSQL, Docker Compose |
| 12 | [`12-hexagonal-architecture`](./12-hexagonal-architecture) | Hexagonal / Ports & Adapters ("Orbit") — framework-free core with swappable outbound adapters (Postgres ↔ in-memory repo, Stripe ↔ Flutterwave mock payment) and two inbound adapters (REST + CLI) driving the same use cases | NestJS, TypeORM, PostgreSQL, Docker Compose |

Each project has a **[HOSTING.md](./01-modular-monolith/HOSTING.md)** guide: local Docker setup, platforms (free → paid), per-component tooling, and production checklists.

| Project | Hosting guide |
|---------|---------------|
| 01 Modular monolith | [`01-modular-monolith/HOSTING.md`](./01-modular-monolith/HOSTING.md) |
| 02 Database sharding | [`02-database-sharding/HOSTING.md`](./02-database-sharding/HOSTING.md) |
| 03 Async queues | [`03-async-queue-processing/HOSTING.md`](./03-async-queue-processing/HOSTING.md) |
| 04 Oja capstone | [`04-ecom-marketplace-capstone/HOSTING.md`](./04-ecom-marketplace-capstone/HOSTING.md) |
| 05 Resilience | [`05-resilience/HOSTING.md`](./05-resilience/HOSTING.md) |
| 06 CAP theorem | [`06-cap-theorem/HOSTING.md`](./06-cap-theorem/HOSTING.md) |
| 07 Monolithic architecture | [`07-monolithic-architecture/HOSTING.md`](./07-monolithic-architecture/HOSTING.md) |
| 08 Microservices architecture | [`08-microservices-architecture/HOSTING.md`](./08-microservices-architecture/HOSTING.md) |
| 09 Event-driven architecture | [`09-event-driven-architecture/HOSTING.md`](./09-event-driven-architecture/HOSTING.md) |
| 10 Serverless architecture | [`10-serverless-architecture/HOSTING.md`](./10-serverless-architecture/HOSTING.md) |
| 11 Layered architecture | [`11-layered-architecture/HOSTING.md`](./11-layered-architecture/HOSTING.md) |
| 12 Hexagonal architecture | [`12-hexagonal-architecture/HOSTING.md`](./12-hexagonal-architecture/HOSTING.md) |

See [`LEVELS-6-7.md`](./LEVELS-6-7.md) for the full concept write-up on resilience and CAP theorem.

## Why this structure

Each numbered folder is a **standalone, independently runnable project** — its own
`package.json`, `docker-compose.yml`, and README explaining the concept, the companies known to
use it (per doc.md: Shopify, Instagram, TikTok, Uber, Amazon, Stripe), and how to run/verify it
locally. Nothing is shared between them on purpose: the goal is for each concept to be
learnable and runnable in isolation before you look at how the capstone wires them together.

`legacy-inmemory-demo/` is the original single-process, in-memory simulation that predates this
restructure. It's kept for reference but superseded by the projects above, which use real
PostgreSQL/Redis/RabbitMQ instead of in-memory stand-ins.

## Running any project

Every project follows the same pattern:

```bash
cd 0N-project-name
cp .env.example .env
docker compose up -d      # starts Postgres/Redis/RabbitMQ/etc.
npm install
npm run start:dev         # or: npm run migration:run && npm run start:dev
```

Interactive **Swagger API docs** are available at `http://localhost:<port>/docs` once the API is running (ports: 3000 for 01–04, 3005 for 05, 3006 for 06, 3007 for 07, 3008 for the 08 gateway, 3009 for 09's order-api, 3010 for 10, 3011 for 11, 3012 for 12). Every HTTP endpoint is documented with request/response schemas.

See each project's own README for exact endpoints and things to try.

> Note: Docker Desktop is installed on this machine but its CLI wasn't on `PATH` / the daemon
> wasn't running when projects 01–06 were built, so `docker compose up` was not executed for
> them at the time. Projects 07–12 were built later, with Docker running, and each one was
> validated end-to-end with `docker compose up --build` plus a live curl walkthrough before
> being considered done — see each project's README for the exact commands that were run.

# 01 — E-Shop (Postgres + Redis + RabbitMQ + API)
cd system-design/01-modular-monolith && cp .env.example .env && docker compose up --build

# 02 — Sharding (3 Postgres shards + API)
cd system-design/02-database-sharding && cp .env.example .env && docker compose up --build -d

# 03 — Async queues (Postgres + RabbitMQ + Kafka + API + worker)
cd system-design/03-async-queue-processing && cp .env.example .env && docker compose up --build -d

# 04 — Capstone (Nginx + 2 APIs + 4 Postgres + Redis + RabbitMQ) — needs ~4–6 GB RAM
cd system-design/04-ecom-marketplace-capstone && cp .env.example .env && docker compose up -d --build

# 05 — Resilience (single API, port 3005)
cd system-design/05-resilience && cp .env.example .env && docker compose up --build

# 06 — CAP theorem (single API, port 3006)
cd system-design/06-cap-theorem && cp .env.example .env && docker compose up --build

# 07 — BlogStack: plain monolith (Postgres + API, port 3007)
cd system-design/07-monolithic-architecture && cp .env.example .env && docker compose up --build

# 08 — BookHive: microservices (gateway :3008 + 4 services + 3 Postgres)
cd system-design/08-microservices-architecture && cp .env.example .env && docker compose up --build -d

# 09 — FreshCart: event-driven pub/sub (order-api :3009 + 4 consumers + 2 Postgres + RabbitMQ)
cd system-design/09-event-driven-architecture && cp .env.example .env && docker compose up --build -d

# 10 — Serverless FaaS emulator (API :3010 + RabbitMQ)
cd system-design/10-serverless-architecture && cp .env.example .env && docker compose up --build -d

# 11 — Riverside Library: layered/N-Tier (Postgres + API, port 3011)
cd system-design/11-layered-architecture && cp .env.example .env && docker compose up --build

# 12 — Orbit: hexagonal/ports & adapters (Postgres + API, port 3012)
cd system-design/12-hexagonal-architecture && cp .env.example .env && docker compose up --build
