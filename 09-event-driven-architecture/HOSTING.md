# Hosting & Deployment Guide — Event-Driven Architecture (FreshCart)

This document covers local Docker setup and production hosting for the event-driven demo: one
NestJS **producer** (`order-api`) and four independent NestJS **consumer** apps
(`inventory-consumer`, `notification-consumer`, `analytics-consumer`, `loyalty-consumer`), two
PostgreSQL databases, and RabbitMQ as the pub/sub broker.

For the fan-out topology, the idempotency proof, and the publish-after-commit ordering
guarantee, see [README.md](./README.md).

---

## Application components

| Component | Role | Required? | Local (Docker) service |
|-----------|------|-----------|-------------------------|
| **order-api** | Producer — `POST /orders`, `GET /orders/:id`; publishes `order.placed` after commit | Yes | `order-api` |
| **inventory-consumer** | Subscribes to `order.placed`; decrements stock in its own DB | Yes | `inventory-consumer` |
| **notification-consumer** | Subscribes to `order.placed`; logs/stores a push notification (in-memory) | Yes | `notification-consumer` |
| **analytics-consumer** | Subscribes to `order.placed`; increments running sales counters (in-memory) | Yes | `analytics-consumer` |
| **loyalty-consumer** | Subscribes to `order.placed`; awards loyalty points, idempotently (in-memory) | Yes | `loyalty-consumer` |
| **order-db (PostgreSQL 16)** | Persists orders — owned exclusively by `order-api` | Yes | `order-db` |
| **inventory-db (PostgreSQL 16)** | Persists stock — owned exclusively by `inventory-consumer` | Yes | `inventory-db` |
| **RabbitMQ 3** | Topic exchange `grocery_events`; one queue per consumer, all bound to `order.placed` | Yes | `rabbitmq` |

Each app is a fully independent NestJS project — own `package.json`, own `Dockerfile`, own
runtime process, own port. None of them share a codebase or a database with each other; the only
shared contract is the exchange name, routing key, and event JSON shape.

---

## Prerequisites (your machine)

| Tool | Version | Purpose |
|------|---------|---------|
| Docker Desktop | Latest | Postgres x2, RabbitMQ, order-api, 4 consumers |
| Docker Compose | v2+ | Orchestration |
| Node.js | 20 LTS | Local dev/build of each app, duplicate-delivery script |
| npm | 10+ | Install, build, scripts |
| curl / jq | Any | API testing |

Optional:

| Tool | Purpose |
|------|---------|
| RabbitMQ Management UI | http://localhost:15672 — inspect the 4 queues bound to `grocery_events` |

---

## Run locally with Docker

### 1. Configure

```bash
cd system-design/09-event-driven-architecture
cp .env.example .env
```

Key variables (see `.env.example` for the full list):

| Variable | Default | Purpose |
|----------|---------|---------|
| `ORDER_DB_PORT` | `5434` on the host | Host-side Postgres port for order-db (kept off `5432` to avoid clashing with other local Postgres instances; inside the Docker network it's always `order-db:5432`) |
| `INVENTORY_DB_PORT` | `5433` on the host | Host-side Postgres port for inventory-db |
| `RABBITMQ_URL` | `amqp://freshcart:...@localhost:5672` | Broker connection (containers use `rabbitmq:5672` internally) |

### 2. Start the full stack

```bash
docker compose up --build -d
```

Starts: `order-db`, `inventory-db`, `rabbitmq`, `order-api` (port `3009`), and all four consumers
(`4101`–`4104`).

> **Port conflicts:** if you already have something bound to `5432`, `5433`, `5434`, `5672`,
> `15672`, `3009`, or `4101`–`4104` on your machine (including another project in this repo),
> edit the `ports:` mapping for the affected service in `docker-compose.yml` rather than stopping
> the other project.

### 3. Verify producer + all four consumers

```bash
curl -s -X POST http://localhost:3009/orders \
  -H 'Content-Type: application/json' \
  -d '{
    "customerId": "customer-42",
    "items": [{ "sku": "milk-1l", "name": "Whole Milk 1L", "quantity": 2, "unitPrice": 1.5 }]
  }' | jq

curl -s http://localhost:4101/stock | jq
curl -s http://localhost:4102/notifications | jq
curl -s http://localhost:4103/stats | jq
curl -s http://localhost:4104/points | jq
```

Expect a fast (sub-second) response from `POST /orders`, and all four `GET` endpoints to reflect
the order independently.

### 4. Idempotency demo

```bash
cd loyalty-consumer
npm install
npm run simulate:duplicate
curl -s http://localhost:4104/points | jq
```

See [README.md](./README.md#idempotency) for the expected output.

### Option B — Infra in Docker, apps on host

```bash
docker compose up -d order-db inventory-db rabbitmq

# Terminal 1
cd order-api && npm install && npm run start:dev

# Terminals 2-5
cd inventory-consumer && npm install && npm run start:dev
cd notification-consumer && npm install && npm run start:dev
cd analytics-consumer && npm install && npm run start:dev
cd loyalty-consumer && npm install && npm run start:dev
```

Point each app's `.env` (copy from its own directory if you add one, or export the vars) at
`localhost` for the Postgres/RabbitMQ ports above.

### Service reference

| Service | URL / Port | Credentials |
|---------|------------|-------------|
| order-api + Swagger | http://localhost:3009/docs | — |
| inventory-consumer | http://localhost:4101/stock | — |
| notification-consumer | http://localhost:4102/notifications | — |
| analytics-consumer | http://localhost:4103/stats | — |
| loyalty-consumer | http://localhost:4104/points | — |
| order-db (Postgres) | localhost:5434 | `freshcart` / `freshcart_password` |
| inventory-db (Postgres) | localhost:5433 | `freshcart` / `freshcart_password` |
| RabbitMQ AMQP | localhost:5672 | `freshcart` / `freshcart_password` |
| RabbitMQ UI | http://localhost:15672 | same |

### Stop and reset

```bash
docker compose down
docker compose down -v   # also wipes order-db + inventory-db volumes
```

---

## Hosting platforms (free → paid)

### Tier 1 — Free / learning

| Platform | Component | Notes |
|----------|-----------|-------|
| **CloudAMQP** | RabbitMQ | Free "Little Lemur" tier — enough for a demo topic exchange + 4 queues |
| **Neon / Supabase** | order-db, inventory-db | Two free Postgres instances (or two databases on one instance) |
| **Fly.io / Render** | order-api + 4 consumers | Five deployables from four Docker images (order-api's own, plus one shared consumer pattern if you templatize) |
| **Oracle Cloud VM** | Full `docker compose` | Free ARM instance runs all 8 containers |

**Free combo:** CloudAMQP + Neon (x2 databases) + Fly.io (5 small apps).

### Tier 2 — Hobby ($15–60/mo)

| Platform | Pattern | Est. cost |
|----------|---------|-----------|
| **DigitalOcean / Hetzner VPS** | `docker compose up -d` for all 8 services on one box | ~$12–20/mo |
| **Railway** | 5 app services + 2 Postgres + RabbitMQ plugin | ~$30–60/mo |
| **Render** | 5 web services + 2 Postgres + external CloudAMQP | ~$35–55/mo |

**Key decision:** every consumer needs a **long-lived RabbitMQ consumer connection** (it's
subscribing, not polling) — prefer containers/background workers over anything that scales to
zero between requests, or the consumer will miss events while asleep.

### Tier 3 — Production ($60–500+/mo)

| Component | Managed options |
|-----------|-----------------|
| **Message broker** | Amazon MQ (RabbitMQ), CloudAMQP dedicated, self-hosted on K8s |
| **order-api / consumers** | ECS Fargate, Cloud Run (min-instances ≥ 1 for consumers), K8s Deployments |
| **Databases** | RDS, Cloud SQL — one instance/database per bounded context, matching this repo's "each consumer owns its own data" rule |

**AWS production pattern:**

```
ALB → ECS (order-api tasks)
        │ publish
        ▼
   Amazon MQ (RabbitMQ) — grocery_events topic exchange
        │ 4 independent queues, 4 independent consumer groups of tasks
        ▼
   ECS (inventory-consumer / notification-consumer / analytics-consumer / loyalty-consumer)
        │
        ▼
   RDS (order-db, inventory-db) — each consumer's DB reachable only by that consumer
```

### Tier 4 — Scale

| Need | Solution |
|------|----------|
| More event types | Additional routing keys on the same `grocery_events` topic exchange; consumers opt in by binding, no producer change |
| A fifth consumer | Copy the shape of `loyalty-consumer` — bind a new queue, deploy independently. See README "Adding loyalty-consumer on day 2." |
| Consumer can't keep up | Scale that consumer's replica count — RabbitMQ distributes messages *within* a queue's competing consumers automatically, without touching the fan-out to the other three queues |
| Cross-service tracing | OpenTelemetry with `eventId` propagated as a trace/span attribute from `order-api` through every consumer's logs |

---

## Per-component production mapping

| Local | Production | Env vars |
|-------|------------|----------|
| `order-api` | Container / PaaS web service | `ORDER_API_PORT`, `ORDER_DB_*`, `RABBITMQ_URL` |
| `inventory-consumer` | Container, no HTTP-facing LB needed except for its own `GET /stock` inspection endpoint | `INVENTORY_CONSUMER_PORT`, `INVENTORY_DB_*`, `RABBITMQ_URL` |
| `notification-consumer` | Container | `NOTIFICATION_CONSUMER_PORT`, `RABBITMQ_URL` |
| `analytics-consumer` | Container | `ANALYTICS_CONSUMER_PORT`, `RABBITMQ_URL` |
| `loyalty-consumer` | Container | `LOYALTY_CONSUMER_PORT`, `RABBITMQ_URL` |
| `order-db` | RDS, Neon, etc. | `ORDER_DB_*` |
| `inventory-db` | RDS, Neon, etc. | `INVENTORY_DB_*` |
| `rabbitmq` | Amazon MQ, CloudAMQP | `RABBITMQ_URL` (`amqps://` in prod) |

**Autoscaling signal per consumer:** that consumer's own queue depth (`inventory.order-placed.queue`
messages ready, etc.) in the RabbitMQ management UI/Prometheus plugin — each queue scales
independently because each consumer is independent.

---

## Additional tools for production

### Message broker operations

| Tool | Purpose |
|------|---------|
| RabbitMQ Management / Prometheus plugin | Per-queue depth and consume rate — compare the 4 `order-placed` queues to confirm fan-out is even |
| Alerting on queue depth | Catch a stuck/crashed consumer before its queue backs up unbounded (no DLQ in this project — see README) |

### CI/CD

| Tool | Purpose |
|------|---------|
| GitHub Actions | `npm run build` per app (5 independent build jobs); build/push 5 images |
| Docker Compose (staging) | Mirror the 8-container local topology |

### Observability

| Tool | Purpose |
|------|---------|
| Sentry | Per-app exceptions — 5 separate DSNs/projects, since these are 5 separate deployables |
| OpenTelemetry | Trace `order.placed` from `order-api`'s publish through each consumer's handler, keyed by `eventId` |
| Grafana | Queue depth per consumer, consumer lag, idempotency-skip rate on loyalty-consumer |

### Security

| Tool | Purpose |
|------|---------|
| TLS on AMQP (`amqps://`) | Encrypt broker traffic in production |
| VPC private subnets | order-api and consumers reach RDS/MQ without public exposure |
| Secrets Manager | `RABBITMQ_URL`, DB credentials — not `.env` in prod |
| Per-consumer DB credentials | inventory-consumer's DB user should not have access to order-db, matching the "each consumer owns its data" boundary |

---

## Environment variables (production checklist)

| Variable | Required by | Notes |
|----------|-------------|-------|
| `NODE_ENV` | All | `production` |
| `ORDER_API_PORT` | order-api | |
| `ORDER_DB_*` | order-api | |
| `INVENTORY_CONSUMER_PORT` | inventory-consumer | |
| `INVENTORY_DB_*` | inventory-consumer | |
| `NOTIFICATION_CONSUMER_PORT` | notification-consumer | |
| `ANALYTICS_CONSUMER_PORT` | analytics-consumer | |
| `LOYALTY_CONSUMER_PORT` | loyalty-consumer | |
| `RABBITMQ_URL` | All 5 apps | Same broker, `amqps://` in prod |

---

## Cost estimate (rough monthly)

| Scenario | Est. cost |
|----------|-----------|
| Local Docker | $0 |
| CloudAMQP free + Neon free (x2) + Fly.io (5 small apps) | $0–10 |
| VPS running full `docker compose` | ~$15–20 |
| Amazon MQ + 2x RDS + 5 ECS services | ~$250–400 |

---

## Related docs

- [README.md](./README.md) — fan-out topology, idempotency proof, publish-after-commit ordering
- [../03-async-queue-processing/README.md](../03-async-queue-processing/README.md) — the
  point-to-point queueing counterpart this project deliberately contrasts with
- [../03-async-queue-processing/HOSTING.md](../03-async-queue-processing/HOSTING.md) — RabbitMQ
  hosting notes that also apply here
