# Hosting & Deployment Guide — Riverside Library

This document covers how to run Riverside Library locally (including Docker) and where to host
it in production. This project is a **single NestJS API backed by one PostgreSQL database** —
the layering it demonstrates (Presentation -> Application -> Domain -> Data Access -> Database)
is an internal code-organization pattern, not a deployment topology, so there is nothing extra to
stand up beyond the API and its database.

For the architecture write-up and API walkthrough, see [README.md](./README.md).

---

## Application components

| Component | Role | Required? | Local (Docker) service |
|-----------|------|-----------|-------------------------|
| **NestJS API** | HTTP entrypoint for `books`, `members`, `loans` — internally split into Presentation/Application/Domain/Data Access | Yes | `api` (port `3011`) |
| **PostgreSQL 16** | Single database, single schema — `books`, `members`, `loans` tables | Yes | `postgres` (port `5432`) |
| **TypeORM migrations** | Schema management (`synchronize: false`) | Yes | Runs on API container startup |

There is no Redis, message broker, or load balancer here — this project is intentionally minimal
so the layering itself stays the focus.

---

## Prerequisites (your machine)

| Tool | Version | Purpose |
|------|---------|---------|
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | Latest | Run Postgres and the API in containers |
| [Docker Compose](https://docs.docker.com/compose/) | v2+ (bundled with Docker Desktop) | Orchestrate the stack |
| [Node.js](https://nodejs.org/) | 20 LTS | Local dev without containerizing the API |
| [npm](https://www.npmjs.com/) | 10+ | Install dependencies, run migrations, run tests |
| [curl](https://curl.se/) | Any | Exercise the API |
| [jq](https://jqlang.github.io/jq/) | Any | Parse JSON responses in the README's curl walkthrough |

---

## Run locally with Docker

### 1. Clone and configure

```bash
cd system-design/11-layered-architecture
cp .env.example .env
```

Defaults in `.env.example` already match `docker-compose.yml`.

### 2. Start the full stack

```bash
docker compose up --build -d
```

This command:

1. Pulls `postgres:16-alpine`
2. Builds the NestJS API image from `Dockerfile`
3. Waits for Postgres's health check to pass
4. Runs TypeORM migrations, then starts the API

**First run** may take a minute or two (image pull + `npm ci` in the build stage).

### 3. Verify services

| Service | URL / Port | Default credentials |
|---------|------------|----------------------|
| API + Swagger | http://localhost:3011/docs | — |
| PostgreSQL | `localhost:5432` | `library` / `library_dev_password` / db `library` |

```bash
# Quick health check
curl -s http://localhost:3011/books

# Follow API logs
docker compose logs -f api
```

### 4. Stop and reset

```bash
# Stop containers, keep data
docker compose down

# Stop and delete volumes (fresh database)
docker compose down -v
```

### Option B — Postgres in Docker, API on the host (hot reload)

Useful when editing TypeScript and you want `nest start --watch`:

```bash
cp .env.example .env
docker compose up -d postgres
npm install
npm run migration:run
npm run start:dev
```

`.env.example` already points `POSTGRES_HOST` at `localhost` for this mode.

### Troubleshooting Docker

| Problem | Fix |
|---------|-----|
| Port 5432/3011 already in use | Stop conflicting services or change host ports in `docker-compose.yml` |
| `api` exits on migration error | `docker compose logs api`; ensure `postgres` is healthy (`docker compose ps`) |
| Docker daemon not running | Start Docker Desktop |

---

## Hosting platforms (free → paid)

Because this app has only two components (a stateless API and one Postgres database), it's cheap
to host anywhere that runs Docker.

### Tier 1 — Free / learning & demos

| Platform | What to host | Notes |
|----------|---------------|-------|
| **[Fly.io](https://fly.io/)** | API container | Free allowance; deploy the `Dockerfile` directly |
| **[Render](https://render.com/)** | API (free web service) | Spins down after inactivity; cold starts |
| **[Railway](https://railway.app/)** | API + Postgres add-on | Trial credits; easy Docker deploy |
| **[Neon](https://neon.tech/)** | PostgreSQL | Free serverless Postgres; replace the `postgres` service |
| **[Supabase](https://supabase.com/)** | PostgreSQL | Free tier Postgres with a dashboard |

**Recommended free combo:** Neon (Postgres) + Fly.io or Render (API).

### Tier 2 — Hobby / small production ($5–20/mo)

| Platform | Best for | Typical cost |
|----------|----------|---------------|
| **[DigitalOcean Droplet](https://www.digitalocean.com/products/droplet)** | Single VM running full `docker compose` | ~$6/mo |
| **[Railway](https://railway.app/)** | Managed Postgres + API from GitHub | ~$5–15/mo |
| **[Render](https://render.com/)** | Managed Postgres + web service (no cold start on paid) | ~$7–20/mo |
| **[Fly.io](https://fly.io/)** | API + attached volume | ~$5–10/mo |

### Tier 3 — Production context

Like the other single-purpose demos in this series, Riverside Library teaches a pattern you'd
embed inside a larger application (e.g., the layered folder structure applied to one module of
`01-modular-monolith`), rather than a service meant to run standalone at scale. If you were
productionizing it as-is:

| Pattern | Where it lives |
|---------|-----------------|
| Managed Postgres with backups | RDS / Cloud SQL / Neon Pro |
| 2+ API replicas behind a load balancer | See `04-ecom-marketplace-capstone` for the Nginx pattern |
| Secrets manager for DB credentials | AWS Secrets Manager, Doppler, Vault |

### Tier 4 — Enterprise

- Read replicas for `GET /books` / `GET /members/:id/loans` if read traffic grows
- Connection pooling (pgBouncer) once multiple API replicas share one Postgres instance
- Structured tracing per layer (e.g., a span for Application, a span for Data Access) to make the
  layering visible in APM tooling, not just in code

---

## Per-component production mapping

| Local service | Managed alternative (free → paid) | Connection env var |
|----------------|-------------------------------------|----------------------|
| `postgres` | Neon → Supabase → RDS / Cloud SQL | `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` |
| `api` | Fly.io → Render → ECS / Cloud Run / K8s | `PORT` |

---

## Tools needed for a functional deployment

### Required (this project)

| Tool | Purpose |
|------|---------|
| Node.js 20 or Docker | Runtime |
| PostgreSQL 16 | Persistence |
| `.env` | Local configuration |

### CI/CD

| Tool | Purpose |
|------|---------|
| [GitHub Actions](https://github.com/features/actions) | `npm test` → `npm run build` → `docker build` → deploy |
| Unit tests | `npm test` — domain-layer specs need no server or database |

Example pipeline: `npm ci` → `npm test` → `npm run build` → `docker build` → push to registry →
deploy → `migration:run`.

### Observability

| Tool | Purpose |
|------|---------|
| Structured logging | Log which use case ran and its outcome |
| Sentry | Capture unhandled exceptions bubbling out of use cases |
| Metrics | `loans_borrowed_total`, `loans_rejected_total{reason}` |

### Database operations

| Tool | Purpose |
|------|---------|
| [pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html) | Backups |
| [TypeORM CLI](https://typeorm.io/migrations) | Migrations (`npm run migration:run`) |

---

## Environment variables (production checklist)

| Variable | Required | Notes |
|----------|----------|-------|
| `NODE_ENV` | Yes | Set to `production` |
| `PORT` | Yes | Usually `3011` or platform-assigned |
| `POSTGRES_*` | Yes | Use a managed DB host in the cloud |

---

## Deployment workflow (summary)

1. **Build:** `docker build -t riverside-library-api .`
2. **Push:** Tag and push to ECR, GCR, Docker Hub, or GHCR
3. **Migrate:** Run `npm run migration:run` (or the Docker entrypoint command) before or during deploy
4. **Deploy:** Start the API with all env vars pointing at managed Postgres
5. **Verify:** `GET /books`, run the `POST /loans` walkthrough from the README
6. **Monitor:** Error rate, 409 rate on `/loans` (a spike may mean a UX problem, not a bug)

---

## Cost estimate (rough monthly)

| Scenario | Components | Est. cost |
|----------|------------|-----------|
| Local dev | Docker on laptop | $0 |
| Free cloud demo | Neon + Fly.io/Render free | $0 |
| Hobby VPS | 1× 1GB Droplet, full compose | ~$6 |
| Small production | Managed Postgres + 2 API instances | ~$30–60 |

---

## Related docs

- [README.md](./README.md) — architecture, layer walkthrough, curl walkthrough
- [../01-modular-monolith/HOSTING.md](../01-modular-monolith/HOSTING.md) — hosting a full modular monolith
- [../README.md](../README.md) — full system design series index
