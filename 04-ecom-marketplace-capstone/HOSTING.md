# Hosting & Deployment Guide — Oja Marketplace Capstone

This document is the full deployment reference for the capstone: a modular monolith with **Nginx load balancing**, **two API replicas**, **one primary PostgreSQL**, **three user/wallet shards**, **Redis**, and **RabbitMQ** with in-process background workers.

For architecture and the end-to-end curl walkthrough, see [README.md](./README.md).

---

## Application components

| Component | Role | Required? | Local (Docker) service |
|-----------|------|-----------|------------------------|
| **Nginx** | Round-robin load balancer; health passthrough | Yes (for capstone demo) | `nginx` (:8080) |
| **API replica 1** | Full NestJS app (`INSTANCE_ID=api-1`) | Yes | `api-1` |
| **API replica 2** | Same image, second replica (`INSTANCE_ID=api-2`) | Yes | `api-2` |
| **PostgreSQL primary** | Marketplace, Orders, Notifications, `user_directory` | Yes | `postgres-primary` (:5432) |
| **PostgreSQL shard 0–2** | Users + Wallets (`hash(userId) % 3`) | Yes | `postgres-shard-0/1/2` (:5433–5435) |
| **Redis 7** | Product list cache-aside, sessions | Yes | `redis` (:6379) |
| **RabbitMQ 3** | `domain_events` → Email/Inventory/Analytics/Wallet workers | Yes | `rabbitmq` (:5672, UI :15672) |
| **TypeORM migrations** | Run on primary + each shard separately | Yes | `npm run migration:run` |

Workers (Email, Inventory, Analytics, Wallet settlement) run **inside each API replica** as RabbitMQ consumers — not separate containers in this capstone.

---

## Prerequisites (your machine)

| Tool | Version | Purpose |
|------|---------|---------|
| Docker Desktop | Latest | Full 10-service stack |
| Docker Compose | v2+ | Orchestration |
| Node.js | 20 LTS | Local dev against dockerized infra |
| npm | 10+ | Migrations, build, tests |
| curl, jq | Any | Walkthrough scripts |

**Resource note:** This stack runs 4 Postgres instances + Redis + RabbitMQ + 2 APIs + Nginx. Allocate **at least 4–6 GB RAM** to Docker Desktop.

Optional:

| Tool | Purpose |
|------|---------|
| [hey](https://github.com/rakyll/hey) | Load test through Nginx :8080 |
| DBeaver | Connect to primary (:5432) and shards (:5433–5435) |
| RabbitMQ UI | Inspect `domain_events` exchange and worker queues |

---

## Run locally with Docker

### 1. Configure

```bash
cd system-design/04-ecom-marketplace-capstone
cp .env.example .env
```

Change `JWT_SECRET` for any non-local deployment.

### 2. Build and start everything

```bash
docker compose up -d --build
```

Compose starts services in dependency order (Postgres/Redis/RabbitMQ healthchecks → API replicas → Nginx).

**First boot:** API containers run migrations on startup (if configured in Dockerfile/entrypoint). If running API on host instead, run migrations manually (step 4 below).

### 3. Verify

| Service | URL / Port | Credentials |
|---------|------------|-------------|
| **Public API (via Nginx)** | http://localhost:8080 | — |
| Swagger (direct to replica) | http://localhost:3000/docs | Only if you expose api-1 port |
| Health | http://localhost:8080/health | Checks primary + 3 shards + Redis + RabbitMQ |
| PostgreSQL primary | localhost:5432 | `oja` / `oja_dev_password` / `oja_primary` |
| Shard 0 / 1 / 2 | localhost:5433 / 5434 / 5435 | `oja` / `oja_dev_password` |
| Redis | localhost:6379 | — |
| RabbitMQ UI | http://localhost:15672 | `oja` / `oja_dev_password` |

```bash
BASE=http://localhost:8080

curl -s $BASE/health | jq
curl -s $BASE/marketplace/products | jq '.[0]'

# Watch both replicas handle requests
docker compose logs -f api-1 api-2
```

### 4. Option B — Infra in Docker, single API on host

```bash
docker compose up -d postgres-primary postgres-shard-0 postgres-shard-1 postgres-shard-2 redis rabbitmq
# Skip nginx, api-1, api-2 — run one API locally

npm install
npm run migration:run   # primary + all 3 shards
npm run start:dev       # http://localhost:3000
```

Use `BASE=http://localhost:3000` for the README walkthrough (no Nginx).

### 5. Observe load balancing

```bash
for i in {1..10}; do
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/health
done
docker compose logs --tail=5 api-1 api-2
```

Check `INSTANCE_ID` in log lines to see round-robin.

### Stop and reset

```bash
docker compose down
docker compose down -v   # wipes all Postgres volumes
```

---

## Hosting platforms (free → paid)

This is the most infrastructure-heavy project in the series. Free tiers can host it on **one VM**; managed cloud spreads cost across many services.

### Tier 1 — Free / learning

| Platform | Approach | Notes |
|----------|----------|-------|
| **Oracle Cloud Always Free** | ARM VM, `docker compose up` | Best free option for full stack |
| **Google Cloud e2-micro** | Same | Tight on RAM — may need swap |
| **Fly.io** | Multiple machines | Complex: 4 DBs hard on free tier |
| **Neon + Upstash + CloudAMQP** | Managed data layer + API on Fly | Replace 4 Postgres with 1 primary + 3 Neon projects |

**Reality check:** Running 4 Postgres instances on free PaaS DB tiers is awkward. A **single VPS with Docker Compose** is the practical free/cheap path.

### Tier 2 — Hobby ($20–80/mo)

| Platform | Stack | Est. cost |
|----------|-------|-----------|
| **Hetzner CPX31 (4 vCPU, 8GB)** | Full docker compose on one VM | ~€8–15/mo |
| **DigitalOcean 4GB Droplet** | Same | ~$24/mo |
| **Railway / Render** | Decompose into managed services | ~$40–80/mo (many billable components) |

**Recommended hobby:** One 8GB VPS + Caddy or Nginx on the host + `docker compose`.

### Tier 3 — Production ($150–600+/mo)

| Layer | AWS example | GCP example |
|-------|-------------|-------------|
| Load balancer | ALB | Cloud Load Balancing |
| API (2+ replicas) | ECS Fargate / EKS | Cloud Run / GKE |
| Primary DB | RDS PostgreSQL | Cloud SQL |
| 3 shard DBs | 3× RDS instances (or 1 RDS + 3 schemas only if you accept non-physical sharding) | Same |
| Cache | ElastiCache Redis | Memorystore |
| Message broker | Amazon MQ | Pub/Sub or self-hosted RabbitMQ |
| CDN (optional) | CloudFront | Cloud CDN |
| Edge / DDoS | Cloudflare (doc.md mentions; out of scope locally) | Cloudflare |

**DigitalOcean simplified production:**

```
DO Load Balancer → 2× App Platform or Droplet (API)
                 → Managed PostgreSQL (primary)
                 → 3× smaller Managed PG (shards) OR Citus later
                 → Managed Redis
                 → Self-hosted RabbitMQ on Droplet OR CloudAMQP
```

### Tier 4 — Scale / enterprise

| Concern | Solution |
|---------|----------|
| More API capacity | Horizontal pod autoscaling; stateless replicas |
| Shard growth | Vitess/Citus or add shard-3 + migration project |
| Multi-region | Geo shards (`02-database-sharding` geo strategy) + regional APIs |
| Wallet CP consistency | Strong consistency per shard; avoid cross-shard transactions |
| Worker isolation | Extract workers from API process into separate worker fleet (`03` pattern) |
| Payments resilience | Integrate patterns from `05-resilience` |

---

## Per-component production mapping

| Local service | Production | Env vars |
|---------------|------------|----------|
| `nginx` | ALB, Cloud LB, Cloudflare, Traefik, Caddy | — |
| `api-1`, `api-2` | N identical containers; set `INSTANCE_ID` per task | `PORT`, `JWT_*`, all `*_DB_*`, `REDIS_URL`, `RABBITMQ_URL` |
| `postgres-primary` | RDS / Cloud SQL | `PRIMARY_DB_*` |
| `postgres-shard-*` | 3× managed Postgres | `SHARD0_DB_*`, `SHARD1_DB_*`, `SHARD2_DB_*`, `SHARD_COUNT` |
| `redis` | ElastiCache / Upstash | `REDIS_URL` |
| `rabbitmq` | Amazon MQ / CloudAMQP | `RABBITMQ_URL` |

### Migration strategy

```bash
npm run migration:run
# Runs: primary → shard0 → shard1 → shard2
```

Each shard maintains its own `migrations` table — running the same migration file four times is intentional.

---

## Additional tools for production

### Load balancing & TLS

| Tool | Purpose |
|------|---------|
| [Cloudflare](https://www.cloudflare.com/) | CDN, DDoS, DNS (mentioned in capstone README) |
| [Caddy](https://caddyserver.com/) | Automatic HTTPS on VPS |
| [cert-manager](https://cert-manager.io/) | TLS on Kubernetes |

Nginx config in this repo (`nginx.conf`) is the template — replace with managed LB in cloud.

### CI/CD

| Tool | Purpose |
|------|---------|
| GitHub Actions | Test → build image → deploy 2+ replicas → run migrations |
| Terraform / Pulumi | Provision 4 databases + cache + MQ |

### Observability

| Tool | Purpose |
|------|---------|
| `/health` endpoint | LB target health (already implemented) |
| Prometheus + Grafana | Per-replica metrics, shard connection pools |
| Sentry | Error tracking across replicas |
| RabbitMQ monitoring | Consumer lag, `order.created` publish rate |
| Distributed tracing | Trace order flow: HTTP → DB → publish → worker |

### Data & ops

| Tool | Purpose |
|------|---------|
| Per-database backups | 4 backup schedules (primary + 3 shards) |
| pgBouncer | Connection pooling per database |
| Runbook for `user_directory` | Reconcile email→shard if registration compensating delete fails |

### Security

| Tool | Purpose |
|------|---------|
| Secrets Manager | `JWT_SECRET`, all DB passwords |
| Private networking | API talks to DB/MQ without public IPs |
| WAF | Cloudflare / AWS WAF on public edge |

### Integrations (from doc.md, not built)

| Module | Hosting note |
|--------|--------------|
| Payment (Paystack/Flutterwave) | See `05-resilience` for retry/circuit breaker patterns |
| Chat | Would need WebSocket service (e.g. Socket.io on separate service or Pusher) |
| School / Admin | Additional modules, same monolith deploy model |

---

## Environment variables (production checklist)

| Variable | Required | Notes |
|----------|----------|-------|
| `INSTANCE_ID` | Yes per replica | Logging and debugging |
| `JWT_SECRET` | Yes | Strong random value |
| `PRIMARY_DB_*` | Yes | Unsharded data |
| `SHARD0/1/2_DB_*` | Yes | User + Wallet |
| `SHARD_COUNT` | Yes | `3` |
| `REDIS_URL` | Yes | |
| `RABBITMQ_URL` | Yes | |

---

## Deployment workflow

1. Provision primary + 3 shard databases; run migrations on each.
2. Provision Redis and RabbitMQ.
3. Build and push Docker image.
4. Deploy **≥2** API replicas (stateless) behind load balancer on port 8080/443.
5. Configure health checks to `GET /health`.
6. Register → login → order → verify wallet debit on correct shard.
7. Monitor RabbitMQ queues and replica logs for worker activity.

---

## Cost estimate (rough monthly)

| Scenario | Est. cost |
|----------|-----------|
| Local Docker | $0 |
| 8GB VPS + compose | ~$12–24 |
| DO: LB + 2 apps + 4 managed DBs + Redis + MQ | ~$200–400 |
| AWS equivalent | ~$300–600+ |

---

## Related docs

- [README.md](./README.md) — architecture diagram, curl walkthrough
- [../01-modular-monolith/HOSTING.md](../01-modular-monolith/HOSTING.md) — modular monolith baseline
- [../02-database-sharding/HOSTING.md](../02-database-sharding/HOSTING.md) — shard hosting
- [../03-async-queue-processing/HOSTING.md](../03-async-queue-processing/HOSTING.md) — worker scaling
- [../05-resilience/HOSTING.md](../05-resilience/HOSTING.md) — payment provider resilience
- [../06-cap-theorem/HOSTING.md](../06-cap-theorem/HOSTING.md) — AP vs CP for wallet vs catalog
