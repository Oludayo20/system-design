# Hosting & Deployment Guide — Database Sharding Demo

This document explains how to run the sharding demo locally with Docker and how to host it in production: three independent PostgreSQL shards, a shard-routing API, and platform options from free tiers to paid managed infrastructure.

For sharding strategies and API examples, see [README.md](./README.md).

---

## Application components

| Component | Role | Required? | Local (Docker) service |
|-----------|------|-----------|------------------------|
| **NestJS API** | HTTP API; `ShardManagerService` routes each request to exactly one shard | Yes | `api` |
| **PostgreSQL shard 0** | Holds ~⅓ of user records (hash strategy) | Yes | `shard-0` (host port `5432`) |
| **PostgreSQL shard 1** | Second shard | Yes | `shard-1` (host port `5433`) |
| **PostgreSQL shard 2** | Third shard | Yes | `shard-2` (host port `5434`) |
| **Init SQL** | `src/db/init/001-create-users-table.sql` applied on first container start | Yes | Mounted into each shard |

There is no Redis, message queue, or load balancer. The API is stateless aside from in-process ID generation (`WORKER_ID`).

---

## Prerequisites (your machine)

| Tool | Version | Purpose |
|------|---------|---------|
| Docker Desktop | Latest | Three Postgres containers + optional API container |
| Docker Compose | v2+ | Orchestration |
| Node.js | 20 LTS | Run API on host with hot reload |
| npm | 10+ | Dependencies, seed script |
| curl / jq | Any | Test API |

Optional:

| Tool | Purpose |
|------|---------|
| DBeaver / pgAdmin | Connect to each shard on ports 5432–5434 |
| [k6](https://k6.io/) / [wrk](https://github.com/wg/wrk) | Load testing routing logic |

---

## Run locally with Docker

### Option A — Full stack (API + 3 shards in Docker)

```bash
cd system-design/02-database-sharding
cp .env.example .env
docker compose up --build -d
```

Verify:

```bash
curl -s http://localhost:3000/docs          # Swagger
curl -s http://localhost:3000/users/_debug/distribution | jq
```

The API container uses internal Docker hostnames (`shard-0`, `shard-1`, `shard-2`) — already set in `docker-compose.yml`.

### Option B — Shards in Docker, API on host (recommended for development)

```bash
cp .env.example .env
docker compose up -d shard-0 shard-1 shard-2
npm install
npm run start:dev
```

`.env.example` maps shards to `localhost:5432`, `5433`, `5434` — matching published ports.

### Seed demo data

```bash
npm run seed
curl -s http://localhost:3000/users/_debug/distribution | jq
```

Expect roughly even distribution with `SHARDING_STRATEGY=hash`.

### Service reference

| Service | Host port | Database | Credentials |
|---------|-----------|----------|-------------|
| Shard 0 | 5432 | `shard_0` | `postgres` / `postgres` |
| Shard 1 | 5433 | `shard_1` | `postgres` / `postgres` |
| Shard 2 | 5434 | `shard_2` | `postgres` / `postgres` |
| API | 3000 | — | Swagger at `/docs` |

### Stop and reset

```bash
docker compose down      # keep shard data
docker compose down -v   # wipe all three shard volumes
```

### Troubleshooting

| Problem | Fix |
|---------|-----|
| Port 5432 in use | Stop local Postgres or change `shard-0` port mapping |
| `geo` strategy + `GET /users/:id` returns 400 | Expected — shard cannot be derived from id alone; see README |
| Uneven distribution after seed with `range` strategy | Demonstrates hot-shard problem; switch to `hash` in `.env` |

---

## Hosting platforms (free → paid)

### Tier 1 — Free / learning

| Platform | What to host | Notes |
|----------|--------------|-------|
| **Oracle Cloud Always Free** | One ARM VM running full `docker compose` | Best free option for 3 DBs + API on one machine |
| **Google Cloud e2-micro** | Same | 12-month free tier |
| **Neon** (×3 projects or branches) | Three logical Postgres instances | Map to `SHARD_0_*`, `SHARD_1_*`, `SHARD_2_*` env vars |
| **Supabase** (free) | One project only — **not** true sharding demo | Use for single-DB dev; sharding lesson needs 3 instances |
| **Fly.io** | API container | Point env at external Postgres hosts |
| **Railway** | API + multiple Postgres plugins | Possible but awkward for 3 separate DBs |

**Honest note:** A true sharding demo needs **three separate database endpoints**. Free tiers that give one Postgres are fine for learning the API code, but not for exercising cross-shard routing.

### Tier 2 — Hobby ($5–50/mo)

| Platform | Approach | Est. cost |
|----------|----------|-----------|
| **Hetzner / DigitalOcean VPS** | `docker compose up` on 4GB VM | ~$6–12/mo |
| **3× Neon / Render Postgres** | Managed shard per instance | ~$0–21/mo depending on tiers |
| **Railway** | API + 3 database services | ~$15–30/mo |

**Recommended hobby setup:** Single VPS with Docker Compose — simplest way to keep three isolated Postgres data directories.

### Tier 3 — Production ($50–500+/mo)

Real sharding at scale typically uses:

| Component | Managed options |
|-----------|-----------------|
| Shard databases | RDS / Cloud SQL / Azure Database (one instance per shard) |
| API | ECS Fargate, Cloud Run, App Platform, K8s |
| Connection pooling | [pgBouncer](https://www.pgbouncer.org/) per shard |
| Shard map / directory | Vitess, Citus, or custom lookup service (out of scope for this demo) |

| Platform | Sharding product | When to use |
|----------|------------------|-------------|
| **[PlanetScale](https://planetscale.com/)** | Vitess-based | MySQL-compatible sharding |
| **[CockroachDB](https://www.cockroachlabs.com/)** | Distributed SQL | Automatic sharding under the hood |
| **[AWS RDS](https://aws.amazon.com/rds/)** | Manual: N instances + app router | What this repo models |
| **[Google Spanner](https://cloud.google.com/spanner)** | Globally distributed | Enterprise scale |

This repo's `ShardManagerService` is the application-level router you'd keep if you self-shard Postgres.

### Tier 4 — Enterprise

- **Vitess** or **Citus** for automated resharding
- **Consul / etcd** for shard map service
- Multi-region shards with geo routing (`SHARDING_STRATEGY=geo`)
- Per-shard read replicas for read-heavy workloads

---

## Per-component production mapping

| Local service | Production equivalent | Env vars |
|---------------|----------------------|----------|
| `shard-0` | RDS instance 1 / Neon project 1 | `SHARD_0_HOST`, `SHARD_0_PORT`, `SHARD_0_DB`, `SHARD_0_USER`, `SHARD_0_PASSWORD` |
| `shard-1` | RDS instance 2 | `SHARD_1_*` |
| `shard-2` | RDS instance 3 | `SHARD_2_*` |
| `api` | Container service | `PORT`, `SHARD_COUNT`, `SHARDING_STRATEGY`, `WORKER_ID` |

**Multi-instance API:** Run 2+ API replicas behind a load balancer. Each replica needs a **distinct `WORKER_ID`** if using `IdGeneratorService` across processes (see `.env.example`).

---

## Additional tools for production

### Required for operability

| Tool | Purpose |
|------|---------|
| **Backup per shard** | `pg_dump` on each shard independently — losing one shard loses ⅓ of users |
| **Migration runner** | Apply `001-create-users-table.sql` (or TypeORM migrations if you add them) to every shard |
| **Health checks** | `GET /users/_debug/distribution` for ops only; add `/health` for LB |

### CI/CD

| Tool | Purpose |
|------|---------|
| GitHub Actions | `npm test` (strategy tests need no DB), `docker build`, deploy |
| Terraform | Provision N Postgres instances + API |

### Observability

| Tool | Purpose |
|------|---------|
| Prometheus | Per-shard connection pool metrics |
| Grafana | Dashboard: row count per shard (`/users/_debug/distribution`) |
| Sentry | API errors |

### Sharding-specific tooling (beyond this demo)

| Tool | Purpose |
|------|---------|
| Shard map service | `userId → shardId` when resharding (not implemented here) |
| [Vitess](https://vitess.io/) | MySQL sharding control plane |
| [Citus](https://www.citusdata.com/) | Postgres extension for distributed tables |
| Custom migration jobs | Move rows between shards when `SHARD_COUNT` changes |

---

## Environment variables (production checklist)

| Variable | Required | Notes |
|----------|----------|-------|
| `PORT` | Yes | HTTP port |
| `SHARD_COUNT` | Yes | Must match number of configured shards |
| `SHARDING_STRATEGY` | Yes | `hash`, `range`, or `geo` |
| `SHARD_N_HOST/PORT/DB/USER/PASSWORD` | Yes | One block per shard (0..N-1) |
| `WORKER_ID` | Yes if multiple API processes | Unique per replica for ID generation |

---

## Deployment workflow

1. Provision 3 isolated Postgres instances (or one VM with 3 containers).
2. Run init/migration SQL on **each** shard.
3. Deploy API with all `SHARD_*` env vars and correct `SHARD_COUNT`.
4. Run `npm run seed` once in staging to verify distribution.
5. Put API behind TLS-terminated load balancer.
6. Schedule per-shard backups and monitor shard balance.

---

## Cost estimate (rough monthly)

| Scenario | Est. cost |
|----------|-----------|
| Local Docker | $0 |
| Free Oracle VM + compose | $0 |
| 3× small managed Postgres + API | ~$45–90 |
| 3× RDS db.t4g.micro + ECS | ~$100–200 |

---

## Related docs

- [README.md](./README.md) — hash vs range vs geo strategies
- [../01-modular-monolith/HOSTING.md](../01-modular-monolith/HOSTING.md) — Postgres + Redis + RabbitMQ hosting
- [../04-ecom-marketplace-capstone/HOSTING.md](../04-ecom-marketplace-capstone/HOSTING.md) — sharding inside the Oja capstone
