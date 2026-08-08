# Hosting & Deployment Guide — BlogStack

This document covers how to run BlogStack locally (including Docker) and where to host it in
production. This project is a **single NestJS API backed by one PostgreSQL database** — no
Redis, no message broker, no load balancer. That's intentional: it's the naive monolith doc.md
describes, so its deployable surface area is deliberately as small as the modular-monolith
projects in this repo get.

For the architecture and API walkthrough, see [README.md](./README.md).

---

## Application components

| Component | Role | Required? | Local (Docker) service |
|-----------|------|-----------|-------------------------|
| **NestJS API** | Auth, Users, Posts, Comments, Notifications — all five modules in one process | Yes | `api` |
| **PostgreSQL 16** | Single shared database, single `public` schema, real cross-module foreign keys | Yes | `postgres` |
| **TypeORM migrations** | Schema management (no `synchronize: true`) | Yes | Runs on API container start, before `node dist/main.js` |

There is no Redis, RabbitMQ, or Nginx here — that absence is the point. Every request that
touches more than one module (e.g. adding a comment) does so via a direct, in-process service
call inside the single `api` container, not via a broker.

---

## Prerequisites (your machine)

| Tool | Version | Purpose |
|------|---------|---------|
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | Latest | Run Postgres and the API in containers |
| [Docker Compose](https://docs.docker.com/compose/) | v2+ (bundled with Docker Desktop) | Orchestrate the stack |
| [Node.js](https://nodejs.org/) | 20 LTS | Local dev without containerizing the API |
| [npm](https://www.npmjs.com/) | 10+ | Install dependencies, run migrations |
| [curl](https://curl.se/) | Any | Exercise endpoints |

---

## Run locally with Docker

### 1. Configure

```bash
cd system-design/07-monolithic-architecture
cp .env.example .env
```

Change `JWT_SECRET` before any shared or production use.

### 2. Start the stack

```bash
docker compose up --build
```

This command:

1. Pulls `postgres:16-alpine`
2. Builds the NestJS API image from `Dockerfile`
3. Waits for Postgres's health check
4. Runs TypeORM migrations, then starts the API

### 3. Verify

| Service | URL / Port | Default credentials |
|---------|------------|----------------------|
| API + Swagger | http://localhost:3007/docs | — |
| PostgreSQL | `localhost:5432` | `blogstack` / `blogstack_dev_password` / db `blogstack` |

```bash
curl -s http://localhost:3007/posts
docker compose logs -f api
```

### 4. Stop and reset

```bash
docker compose down       # stop containers, keep data
docker compose down -v    # stop and delete the Postgres volume
```

### Option B — Postgres in Docker, API on the host (hot reload)

```bash
cp .env.example .env
docker compose up -d postgres
npm install
npm run migration:run
npm run start:dev
```

`.env.example` already points `POSTGRES_HOST` at `localhost` for this mode.

### Troubleshooting

| Problem | Fix |
|---------|-----|
| Port 5432 or 3007 already in use | Stop conflicting services or change host ports in `docker-compose.yml` |
| `api` exits on migration error | `docker compose logs api`; confirm Postgres is healthy first |
| Docker daemon not running | Start Docker Desktop |

---

## Hosting platforms (free → paid)

Because this is one stateless-ish API plus one Postgres database, it's cheap to host — similar
cost profile to `05-resilience`, but with a real database dependency.

### Tier 1 — Free

| Platform | What to host |
|----------|--------------|
| **[Fly.io](https://fly.io/)** | API container (free allowance) |
| **[Render](https://render.com/)** | API free web service (spins down when idle) |
| **[Neon](https://neon.tech/)** | Free serverless Postgres — replace `postgres` service |
| **[Railway](https://railway.app/)** | API + Postgres add-on, trial credits |

**Recommended free combo:** Neon (Postgres) + Fly.io or Render (API).

### Tier 2 — Hobby ($5–20/mo)

| Platform | Est. cost |
|----------|-----------|
| DigitalOcean Droplet running `docker compose` | ~$6–12/mo |
| Render paid web service + managed Postgres | ~$7–20/mo |
| Railway (API + Postgres) | ~$5–15/mo |

### Tier 3 — Production context

This demo teaches the monolith *shape*, not a service you'd run standalone at scale. In
production, the tradeoff this project makes concrete — one deploy for every module, one failure
domain for every request — is exactly what pushes teams toward `01-modular-monolith`'s enforced
boundaries or, eventually, splitting a hot module (like `comments`) into its own service.

| Pattern | Where it lives instead |
|---------|-------------------------|
| Module boundaries + domain events | `01-modular-monolith` |
| Retry/circuit breaker around a synchronous call like `notifyNewComment()` | `05-resilience` |

### Tier 4 — Enterprise

- Extract `comments` into its own deployable service once its traffic outgrows the rest of the app
- Managed Postgres with read replicas (RDS, Cloud SQL) once read traffic on `GET /posts` grows
- Structured logging + APM (Datadog, Honeycomb) to see which module is slow inside one process

---

## Per-component production mapping

| Local service | Managed alternative (free → paid) | Connection env var |
|----------------|-------------------------------------|---------------------|
| `postgres` | Neon → Supabase → RDS / Cloud SQL | `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` |
| `api` | Fly.io → Render → ECS / Cloud Run | `PORT`, `JWT_SECRET`, `JWT_EXPIRES_IN` |

---

## Environment variables (production checklist)

| Variable | Required | Notes |
|----------|----------|-------|
| `POSTGRES_HOST` / `PORT` / `USER` / `PASSWORD` / `DB` | Yes | Point at your managed Postgres instance |
| `JWT_SECRET` | Yes | Long random value from a secrets manager, never committed |
| `JWT_EXPIRES_IN` | No | Defaults to `1h` |

### CI/CD

| Tool | Purpose |
|------|---------|
| [GitHub Actions](https://github.com/features/actions) | `npm test` → `npm run build` → `docker build` → deploy |

Example pipeline: `npm ci` → `npm test` → `docker build` → push to registry → deploy → `migration:run`.

### Observability

| Tool | Purpose |
|------|---------|
| [Sentry](https://sentry.io/) | Error tracking across the whole process — remember every module shares one failure domain here |
| [pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html) | Postgres backups |

---

## Related docs

- [README.md](./README.md) — concept explanation and API walkthrough
- [../01-modular-monolith/HOSTING.md](../01-modular-monolith/HOSTING.md) — hosting guide for the enforced-boundaries version of this same shape
- [../doc.md](../doc.md) — source transcript
