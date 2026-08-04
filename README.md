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

See each project's own README for exact endpoints and things to try.

> Note: Docker Desktop is installed on this machine but its CLI wasn't on `PATH` / the daemon
> wasn't running when these projects were built, so `docker compose up` has not been executed
> here. Start Docker Desktop first, then run the commands above.
