# Hosting & Deployment Guide — Orbit (Hexagonal Architecture)

This document covers how to run Orbit locally (including Docker) and where to host it in
production: which platforms to use, what each component needs, and recommended tooling from
free tiers through paid production stacks.

For architecture, business rules, and API/CLI walkthroughs, see [README.md](./README.md).

---

## Application components

| Component | Role in this project | Required? | Local (Docker) service |
|-----------|----------------------|-----------|-------------------------|
| **NestJS API** | HTTP inbound adapter — `POST /subscriptions`, `POST /subscriptions/:id/change-plan`, `POST /subscriptions/:id/cancel`, `GET /subscriptions/:id` | Yes | `api` |
| **PostgreSQL 16** | Outbound adapter target when `REPOSITORY=postgres` — one `subscriptions` table | Only when `REPOSITORY=postgres` (the Docker default) | `postgres` |
| **In-memory repository** | Outbound adapter used when `REPOSITORY=memory` — no external service at all | Alternative to Postgres | n/a (in-process) |
| **Stripe/Flutterwave mock gateways** | Outbound adapters, both simulated in-process — no real network calls, no API keys | Yes (one or the other, via `PAYMENT_PROVIDER`) | n/a (in-process) |
| **TypeORM migrations** | Schema management for the `subscriptions` table (no `synchronize: true`) | Only when `REPOSITORY=postgres` | Runs on API container startup |
| **Orbit CLI** | Second inbound adapter (`npm run cli`), drives the same core use cases as the API | Optional — a demo/ops tool, not a deployable service | Run on host or inside the `api` image |

There is no Redis, message broker, or load balancer in this project — the entire point is the
core/adapter split, not extra infrastructure.

---

## Prerequisites (your machine)

| Tool | Version | Purpose |
|------|---------|---------|
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | Latest | Run Postgres and the API in containers |
| [Docker Compose](https://docs.docker.com/compose/) | v2+ (bundled with Docker Desktop) | Orchestrate the stack |
| [Node.js](https://nodejs.org/) | 20 LTS | Local dev without containerizing the API, and to run the CLI |
| [npm](https://www.npmjs.com/) | 10+ | Install dependencies, run migrations, run the CLI |
| [curl](https://curl.se/) or [HTTPie](https://httpie.io/) | Any | Test endpoints |
| [Git](https://git-scm.com/) | Any | Clone and deploy |

Optional but useful:

| Tool | Purpose |
|------|---------|
| [jq](https://jqlang.github.io/jq/) | Parse JSON in shell scripts |
| [Postman](https://www.postman.com/) / [Insomnia](https://insomnia.rest/) | Interactive API testing |
| [DBeaver](https://dbeaver.io/) / [pgAdmin](https://www.pgadmin.org/) | Inspect the `subscriptions` table |

---

## Run locally with Docker

### 1. Clone and configure

```bash
cd system-design/12-hexagonal-architecture
cp .env.example .env
```

`docker-compose.yml` defaults `REPOSITORY=postgres` and `PAYMENT_PROVIDER=stripe` for the `api`
service regardless of `.env` (Postgres is always available in Compose) — override either by
exporting the env var before `docker compose up`, e.g. `PAYMENT_PROVIDER=flutterwave docker
compose up --build`.

### 2. Start the stack

```bash
docker compose up --build -d
```

This command:

1. Pulls `postgres:16-alpine`
2. Builds the NestJS API image from `Dockerfile`
3. Waits for Postgres's health check
4. Runs TypeORM migrations (only when `REPOSITORY=postgres`), then starts the API

**First run** may take 1–3 minutes (image pull + `npm ci` in the build stage).

### 3. Verify services

| Service | URL / Port | Default credentials |
|---------|------------|----------------------|
| API + Swagger | http://localhost:3012/docs | — |
| PostgreSQL | `localhost:5432` | `orbit` / `orbit_dev_password` / db `orbit` |

```bash
# Quick health check via Swagger JSON
curl -s http://localhost:3012/docs-json | head -c 200

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
# in .env: REPOSITORY=postgres, POSTGRES_HOST=localhost
npm install
npm run migration:run
npm run start:dev
```

### Run fully standalone (no Docker at all)

`REPOSITORY=memory` needs no database whatsoever:

```bash
cp .env.example .env   # REPOSITORY=memory by default
npm install
npm run start:dev
```

### Troubleshooting Docker

| Problem | Fix |
|---------|-----|
| Port 5432/3012 already in use | Stop conflicting services or change host ports in `docker-compose.yml` |
| `api` exits on migration error | `docker compose logs api`; ensure Postgres is healthy |
| `api` container skips migrations | Expected when `REPOSITORY=memory` — check the log line "REPOSITORY=memory — skipping migrations." |
| Docker daemon not running | Start Docker Desktop |

---

## Hosting platforms (free → paid)

Platforms are listed in approximate cost order.

### Tier 1 — Free / learning & demos

| Platform | What to host | Limits / notes |
|----------|---------------|-----------------|
| **[Fly.io](https://fly.io/)** | API container | Free allowance; good for one small VM + volume |
| **[Render](https://render.com/)** | API (free web service) | Spins down after inactivity; cold starts |
| **[Railway](https://railway.app/)** | API + Postgres add-on | Trial credits; easy Docker deploy |
| **[Neon](https://neon.tech/)** | PostgreSQL | Free serverless Postgres; replace `postgres` service |
| **[Supabase](https://supabase.com/)** | PostgreSQL | Free tier Postgres alternative to Neon |

**Recommended free combo:** Neon (Postgres) + Fly.io or Render (API). Or skip Postgres entirely
and demo with `REPOSITORY=memory` — this project is one of the cheapest in the series to run
because the in-memory adapter is a legitimate, fully-functional alternative, not a stub.

### Tier 2 — Hobby / small production ($5–50/mo)

| Platform | Best for | Typical cost |
|----------|----------|----------------|
| **[DigitalOcean Droplet](https://www.digitalocean.com/products/droplet)** | Single VM running full `docker compose` | ~$6–12/mo |
| **[Hetzner Cloud](https://www.hetzner.com/cloud)** | Same as DO; strong price/performance in EU | ~€4–10/mo |
| **[Railway](https://railway.app/)** | Managed Postgres + API from GitHub | ~$5–20/mo |
| **[Render](https://render.com/)** | Managed Postgres + web service (no cold start on paid) | ~$7–25/mo |

### Tier 3 — Production / growth ($50–500+/mo)

| Platform | Components | Notes |
|----------|------------|-------|
| **[AWS](https://aws.amazon.com/)** | ECS Fargate or EKS (API), RDS PostgreSQL | Use Secrets Manager for real payment provider keys if this ever talks to a live gateway |
| **[Google Cloud](https://cloud.google.com/)** | Cloud Run, Cloud SQL | Good autoscaling on Cloud Run |
| **[DigitalOcean](https://www.digitalocean.com/)** | App Platform or DOKS, Managed Postgres | Simpler than the big three clouds |

**Recommended production stack (AWS example):**

```
Internet → ALB → ECS Fargate (API, 2+ tasks)
              → RDS PostgreSQL (Multi-AZ)
Secrets: AWS Secrets Manager (real payment provider keys, DB password)
Logs: CloudWatch
```

### Tier 4 — Scale / enterprise ($500+/mo)

| Need | Options |
|------|---------|
| Multi-region API | Cloudflare + regional ECS/GKE clusters |
| Read replicas | RDS read replicas if subscription reads dominate |
| Real payment providers | Swap `StripeMockAdapter`/`FlutterwaveMockAdapter` for real SDK-backed adapters implementing the same `PaymentGatewayPort` — no core changes needed |
| Observability | Datadog, New Relic, Grafana Cloud |

---

## Per-component production mapping

| Local service | Managed alternative (free → paid) | Connection env var |
|----------------|-------------------------------------|----------------------|
| `postgres` | Neon → Supabase → RDS / Cloud SQL | `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` |
| `api` | Fly.io → Render → ECS / Cloud Run / K8s | `PORT`, `REPOSITORY`, `PAYMENT_PROVIDER` |
| `StripeMockAdapter` / `FlutterwaveMockAdapter` | Real Stripe/Flutterwave SDK adapter implementing `PaymentGatewayPort` | Provider secret key(s), via Secrets Manager |

---

## Additional tools for a functional production system

These are not in the repo but are expected in real deployments:

### CI/CD

| Tool | Purpose |
|------|---------|
| [GitHub Actions](https://github.com/features/actions) | Build Docker image, run tests, deploy |
| [GitLab CI](https://about.gitlab.com/stages-devops-lifecycle/continuous-integration/) | Same |

Example pipeline steps: `npm ci` → `npm test` → `docker build` → push to registry → deploy →
`migration:run`.

### Secrets & config

| Tool | Purpose |
|------|---------|
| [Doppler](https://www.doppler.com/) | Centralized secrets |
| [AWS Secrets Manager](https://aws.amazon.com/secrets-manager/) | Cloud-native secrets |

Never commit production database passwords or real payment provider keys.

### Monitoring & alerting

| Tool | Purpose |
|------|---------|
| [Sentry](https://sentry.io/) | Error tracking |
| [Prometheus](https://prometheus.io/) + [Grafana](https://grafana.com/) | Metrics and dashboards |
| [UptimeRobot](https://uptimerobot.com/) | Free uptime checks |

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
| `PORT` | Yes | Usually `3012` or platform-assigned |
| `REPOSITORY` | Yes | `postgres` in any real deployment; `memory` loses all data on restart |
| `PAYMENT_PROVIDER` | Yes | `stripe` or `flutterwave` — both are mocked here; a real deployment needs a real-SDK adapter |
| `POSTGRES_*` | Only if `REPOSITORY=postgres` | Use a managed DB host in cloud |

---

## Deployment workflow (summary)

1. **Build:** `docker build -t orbit-api .`
2. **Push:** Tag and push to ECR, GCR, Docker Hub, or GHCR
3. **Migrate:** Run `npm run migration:run` (or the Docker entrypoint command) before or during deploy — only needed when `REPOSITORY=postgres`
4. **Deploy:** Start API with `REPOSITORY=postgres` and Postgres connection env vars pointing at the managed database
5. **Verify:** `POST /subscriptions`, `GET /subscriptions/:id`
6. **Monitor:** Health endpoint, error rate

---

## Cost estimate (rough monthly)

| Scenario | Components | Est. cost |
|----------|------------|-----------|
| Local dev (in-memory) | Node process, no DB | $0 |
| Local dev (Docker + Postgres) | Docker on laptop | $0 |
| Free cloud demo | Neon + Fly.io/Render free | $0 |
| Hobby VPS | 1× 1GB Droplet, full compose | ~$6 |
| Small production | Managed Postgres + 2 API instances | ~$40–80 |

---

## Related docs

- [README.md](./README.md) — architecture, concept, curl/CLI walkthrough
- [../README.md](../README.md) — full system design series index
- [../01-modular-monolith/HOSTING.md](../01-modular-monolith/HOSTING.md) — a fuller stack (Postgres + Redis + RabbitMQ) for comparison
