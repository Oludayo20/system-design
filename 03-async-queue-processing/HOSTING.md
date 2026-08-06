# Hosting & Deployment Guide — Async Queue Processing

This document covers local Docker setup and production hosting for the async processing demo: a NestJS **producer** API, separate **worker** processes, PostgreSQL, RabbitMQ (with retry/DLQ), and Kafka (broadcast comparison).

For architecture and retry topology, see [README.md](./README.md).

---

## Application components

| Component | Role | Required? | Local (Docker) service |
|-----------|------|-----------|------------------------|
| **NestJS API (producer)** | `POST /rides` — saves trip, publishes `ride.completed`, returns immediately | Yes | `api` |
| **Worker process** | Email, Analytics, Loyalty consumers; retry + dead-letter handling | Yes | `worker` (scalable) |
| **PostgreSQL 16** | Persists ride records (synchronous write path) | Yes | `postgres` |
| **RabbitMQ 3** | Topic exchange `ride_events`; work queues + retry + DLQ | Yes | `rabbitmq` |
| **Kafka 3.7** | Standalone broadcast demo (`order-events` topic) | Optional | `kafka` |

The API and worker are **separate entrypoints** (`dist/main.js` vs `dist/worker.main.js`) — this mirrors production where workers scale independently.

---

## Prerequisites (your machine)

| Tool | Version | Purpose |
|------|---------|---------|
| Docker Desktop | Latest | Postgres, RabbitMQ, Kafka, API, worker |
| Docker Compose | v2+ | Orchestration; `docker compose up --scale worker=N` |
| Node.js | 20 LTS | Local dev, Kafka scripts, load test |
| npm | 10+ | Build, test, scripts |
| curl / jq | Any | API testing |

Optional:

| Tool | Purpose |
|------|---------|
| RabbitMQ Management UI | http://localhost:15672 — queue depth, DLQ inspection |
| [kafkacat / kcat](https://github.com/edenhill/kcat) | Debug Kafka topics |
| [Artillery](https://www.artillery.io/) | Alternative to built-in `npm run load-test` |

---

## Run locally with Docker

### 1. Configure

```bash
cd system-design/03-async-queue-processing
cp .env.example .env
```

Key variables:

| Variable | Default | Purpose |
|----------|---------|---------|
| `EMAIL_FAILURE_RATE` | `0.3` | Simulates flaky email provider for retry/DLQ demo |
| `RABBITMQ_URL` | `amqp://async_demo:...@localhost:5672` | Broker connection |
| `KAFKA_BROKERS` | `localhost:9092` | Kafka scripts only |

### 2. Start full stack

```bash
docker compose up --build -d
```

Starts: `postgres`, `rabbitmq`, `kafka`, `api` (port 3000), `worker` (1 replica).

### 3. Verify producer + workers

```bash
curl -s -X POST http://localhost:3000/rides \
  -H 'Content-Type: application/json' \
  -d '{
    "riderId": "rider-42",
    "driverId": "driver-7",
    "fare": 24.50,
    "pickupLocation": "Ikeja, Lagos",
    "dropoffLocation": "Lekki, Lagos"
  }' | jq

docker compose logs -f worker
```

Expect sub-second API response; workers log receipt/analytics/loyalty **after** the HTTP response.

### 4. Scale workers (traffic-spike demo)

```bash
docker compose up -d --scale worker=20
npm run load-test
```

API latency stays flat; queue drain time improves with more workers.

### 5. Kafka broadcast demo (host terminals)

Requires `kafka` container running:

```bash
# Terminal 1–3
npm run kafka:consume:inventory
npm run kafka:consume:analytics
npm run kafka:consume:fraud

# Terminal 4
npm run kafka:produce
```

### Option B — Infra in Docker, API + worker on host

```bash
docker compose up -d postgres rabbitmq kafka
npm install
npm run build

# Terminal 1
npm run start:dev

# Terminal 2
npm run start:worker:dev
```

### Service reference

| Service | URL / Port | Credentials |
|---------|------------|-------------|
| API + Swagger | http://localhost:3000/docs | — |
| PostgreSQL | localhost:5432 | `async_demo` / `async_demo_password` |
| RabbitMQ AMQP | localhost:5672 | `async_demo` / `async_demo_password` |
| RabbitMQ UI | http://localhost:15672 | same |
| Kafka | localhost:9092 | PLAINTEXT (dev only) |

### Stop and reset

```bash
docker compose down
docker compose down -v   # wipe postgres + kafka volumes
```

---

## Hosting platforms (free → paid)

### Tier 1 — Free / learning

| Platform | Component | Notes |
|----------|-----------|-------|
| **CloudAMQP** | RabbitMQ | Free "Little Lemur" — enough for demos |
| **Neon / Supabase** | PostgreSQL | Free Postgres for rides table |
| **Upstash Kafka** | Kafka | Serverless Kafka free tier for broadcast scripts |
| **Fly.io / Render** | API + worker as separate services | Two deployables from same Docker image, different `CMD` |
| **Oracle Cloud VM** | Full `docker compose` | Free ARM instance runs everything |

**Free combo:** CloudAMQP + Neon + Fly.io (API) + Fly.io (worker machine or second process).

### Tier 2 — Hobby ($10–50/mo)

| Platform | Pattern | Est. cost |
|----------|---------|-----------|
| **DigitalOcean / Hetzner VPS** | `docker compose` with `--scale worker=3` | ~$12/mo |
| **Railway** | API service + worker service + Postgres + RabbitMQ plugin | ~$20–40/mo |
| **Render** | Web service (API) + background worker + Postgres | ~$21–35/mo |

**Key decision:** Workers must run as a **long-lived process** (not ideal for vanilla Lambda + RabbitMQ consume). Prefer containers, Render background workers, or Railway.

### Tier 3 — Production ($50–500+/mo)

| Component | Managed options |
|-----------|-----------------|
| **Message broker (jobs)** | Amazon MQ (RabbitMQ), CloudAMQP dedicated, self-hosted on K8s |
| **Event streaming** | Amazon MSK, Confluent Cloud, Upstash Kafka |
| **Workers** | ECS Fargate, Cloud Run jobs (for SQS), K8s Deployments with HPA |
| **Database** | RDS, Cloud SQL |
| **Alternative job model** | **AWS SQS + Lambda** (see README — better Lambda fit than RabbitMQ) |

**AWS production pattern (RabbitMQ):**

```
ALB → ECS (API tasks)
        ↓ publish
     Amazon MQ (RabbitMQ)
        ↓ consume
     ECS (worker tasks, autoscale on queue depth)
     RDS (PostgreSQL)
```

**AWS production pattern (SQS + Lambda):**

```
API Gateway / ALB → Lambda or ECS (API) → SQS → Lambda (per message)
```

### Tier 4 — Scale

| Need | Solution |
|------|----------|
| 100k+ msgs/min | Kafka + consumer groups, or RabbitMQ cluster + many workers |
| DLQ operations | AWS SQS DLQ, RabbitMQ DLQ queues (already in repo) |
| Exactly-once | Idempotent consumers + dedup keys (not in demo) |
| Observability | Broker metrics, OpenTelemetry traces across publish/consume |

---

## Per-component production mapping

| Local | Production | Env vars |
|-------|------------|----------|
| `api` | Container / PaaS web service | `PORT`, `POSTGRES_*`, `RABBITMQ_URL` |
| `worker` | Separate container fleet; **same image**, `command: node dist/worker.main.js` | `RABBITMQ_URL`, `EMAIL_FAILURE_RATE` (set `0` in prod) |
| `postgres` | RDS, Neon, etc. | `POSTGRES_HOST`, etc. |
| `rabbitmq` | Amazon MQ, CloudAMQP | `RABBITMQ_URL` (`amqps://` in prod) |
| `kafka` | MSK, Confluent, Upstash | `KAFKA_BROKERS` |

**Autoscaling signal:** RabbitMQ queue depth (`email.queue` messages ready) → scale worker replicas.

---

## Additional tools for production

### Message broker operations

| Tool | Purpose |
|------|---------|
| RabbitMQ Management / Prometheus plugin | Queue depth, publish/consume rates |
| Dead-letter queue alerts | Alert when `email.queue.dead-letter` > 0 |
| [MassTransit](https://masstransit.io/) / custom dashboards | Ops visibility (if you outgrow raw AMQP) |

### CI/CD

| Tool | Purpose |
|------|---------|
| GitHub Actions | Build one image; deploy `api` and `worker` with different commands |
| Docker Compose (staging) | Mirror prod topology |

Example deploy matrix:

```yaml
# Pseudocode — two services, one image
api:
  command: node dist/main.js
worker:
  command: node dist/worker.main.js
  replicas: 5
```

### Observability

| Tool | Purpose |
|------|---------|
| Sentry | API + worker exceptions |
| OpenTelemetry | Trace `ride.completed` from HTTP → queue → worker |
| Grafana | Queue lag, worker throughput, DLQ size |

### Load testing

| Tool | Purpose |
|------|---------|
| `npm run load-test` (included) | Spike `POST /rides` |
| k6 / Artillery | Production load test scripts |

### Security

| Tool | Purpose |
|------|---------|
| TLS on AMQP (`amqps://`) | Encrypt broker traffic |
| VPC private subnets | API and workers talk to RDS/MQ without public exposure |
| Secrets Manager | `RABBITMQ_URL`, DB credentials |

---

## Environment variables (production checklist)

| Variable | Required | Notes |
|----------|----------|-------|
| `NODE_ENV` | Yes | `production` |
| `PORT` | API only | |
| `POSTGRES_*` | API only | Workers in this repo don't use DB |
| `RABBITMQ_URL` | API + worker | Same broker for both |
| `EMAIL_FAILURE_RATE` | Worker | Set `0` in production |
| `KAFKA_BROKERS` | Kafka scripts only | Not used by API/worker |

---

## Worker scaling cheat sheet

| Command | Effect |
|---------|--------|
| `docker compose up -d --scale worker=1` | 1 consumer set |
| `docker compose up -d --scale worker=20` | 20 competing consumers on same queues |
| K8s `replicas: 10` on worker Deployment | Same as scale=20 in compose |

RabbitMQ distributes messages across consumers on the same queue — no code changes needed.

---

## Cost estimate (rough monthly)

| Scenario | Est. cost |
|----------|-----------|
| Local Docker | $0 |
| CloudAMQP free + Neon free + Fly.io | $0 |
| VPS full stack | ~$12 |
| Amazon MQ + RDS + 2 ECS services | ~$150–300 |

---

## Related docs

- [README.md](./README.md) — retry/DLQ topology, Kafka vs RabbitMQ
- [../01-modular-monolith/HOSTING.md](../01-modular-monolith/HOSTING.md) — RabbitMQ event bus in monolith
- [../04-ecom-marketplace-capstone/HOSTING.md](../04-ecom-marketplace-capstone/HOSTING.md) — capstone workers
