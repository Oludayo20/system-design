# Hosting & Deployment Guide — E-Shop Modular Monolith

This document covers everything you need to run the E-Shop modular monolith locally (with Docker) and deploy it to production: which platforms to use, what each component needs, and recommended tooling from free tiers through paid production stacks.

For architecture and API walkthroughs, see [README.md](./README.md).

---

## Application components

| Component | Role in this project | Required? | Local (Docker) service |
|-----------|---------------------|-----------|------------------------|
| **NestJS API** | HTTP entrypoint; Identity, Catalog, Basket, Ordering modules; in-process RabbitMQ consumers (Inventory, Notifications) | Yes | `api` |
| **PostgreSQL 16** | Primary datastore; schema-per-module (`identity`, `catalog`, `basket`, `ordering`) | Yes | `postgres` |
| **Redis 7** | Session tokens, product cache-aside | Yes | `redis` |
| **RabbitMQ 3** | Domain event bus (`domain_events` topic exchange) | Yes | `rabbitmq` |
| **TypeORM migrations** | Schema management (no `synchronize: true`) | Yes | Runs on API startup in Docker |

There is no separate frontend, CDN, or load balancer in this project — a single API instance is the full deployable unit.

---

## Prerequisites (your machine)

| Tool | Version | Purpose |
|------|---------|---------|
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | Latest | Run Postgres, Redis, RabbitMQ, and the API in containers |
| [Docker Compose](https://docs.docker.com/compose/) | v2+ (bundled with Docker Desktop) | Orchestrate the stack |
| [Node.js](https://nodejs.org/) | 20 LTS | Local dev without containerizing the API |
| [npm](https://www.npmjs.com/) | 10+ | Install dependencies, run migrations |
| [curl](https://curl.se/) or [HTTPie](https://httpie.io/) | Any | Test endpoints |
| [Git](https://git-scm.com/) | Any | Clone and deploy |

Optional but useful:

| Tool | Purpose |
|------|---------|
| [jq](https://jqlang.github.io/jq/) | Parse JSON in shell scripts |
| [Postman](https://www.postman.com/) / [Insomnia](https://insomnia.rest/) | Interactive API testing |
| [DBeaver](https://dbeaver.io/) / [pgAdmin](https://www.pgadmin.org/) | Inspect PostgreSQL schemas |
| [Redis Insight](https://redis.io/insight/) | Inspect Redis keys |

---

## Run locally with Docker

### 1. Clone and configure

```bash
cd system-design/01-modular-monolith
cp .env.example .env
```

Review `.env` — defaults match `docker-compose.yml`. Change `JWT_SECRET` before any shared or production use.

### 2. Start the full stack

```bash
docker compose up --build
```

This command:

1. Pulls `postgres:16-alpine`, `redis:7-alpine`, `rabbitmq:3-management-alpine`
2. Builds the NestJS API image from `Dockerfile`
3. Waits for health checks on Postgres, Redis, and RabbitMQ
4. Runs TypeORM migrations, then starts the API

**First run** may take 2–5 minutes (image pulls + `npm ci` in the build stage).

### 3. Verify services

| Service | URL / Port | Default credentials |
|---------|------------|---------------------|
| API + Swagger | http://localhost:3000/docs | — |
| PostgreSQL | `localhost:5432` | `eshop` / `eshop_dev_password` / db `eshop` |
| Redis | `localhost:6379` | No password |
| RabbitMQ AMQP | `localhost:5672` | `eshop` / `eshop_dev_password` |
| RabbitMQ Management UI | http://localhost:15672 | `eshop` / `eshop_dev_password` |

```bash
# Quick health check
curl -s http://localhost:3000/catalog/products | head -c 200

# Follow API logs (inventory + notification consumers)
docker compose logs -f api
```

### 4. Stop and reset

```bash
# Stop containers, keep data
docker compose down

# Stop and delete volumes (fresh database)
docker compose down -v
```

### Option B — Infra in Docker, API on the host (hot reload)

Useful when editing TypeScript and you want `nest start --watch`:

```bash
cp .env.example .env
docker compose up -d postgres redis rabbitmq
npm install
npm run migration:run
npm run start:dev
```

`.env.example` already points `POSTGRES_HOST`, `REDIS_URL`, and `RABBITMQ_URL` at `localhost`.

### Troubleshooting Docker

| Problem | Fix |
|---------|-----|
| Port 5432/6379/3000 already in use | Stop conflicting services or change host ports in `docker-compose.yml` |
| `api` exits on migration error | `docker compose logs api`; ensure Postgres is healthy |
| RabbitMQ consumers not firing | Check `docker compose logs api`; confirm `domain_events` exchange in management UI |
| Docker daemon not running | Start Docker Desktop |

---

## Hosting platforms (free → paid)

Platforms are listed in approximate cost order. Pick based on traffic, team size, and how much ops work you want to do.

### Tier 1 — Free / learning & demos

| Platform | What to host | Limits / notes |
|----------|--------------|----------------|
| **[Fly.io](https://fly.io/)** | API container | Free allowance; good for one small VM + volume |
| **[Render](https://render.com/)** | API (free web service) | Spins down after inactivity; cold starts |
| **[Railway](https://railway.app/)** | API + add-on databases | Trial credits; easy Docker deploy |
| **[Neon](https://neon.tech/)** | PostgreSQL | Free serverless Postgres; replace `postgres` service |
| **[Upstash](https://upstash.com/)** | Redis | Free tier; replace `redis` service |
| **[CloudAMQP](https://www.cloudamqp.com/)** | RabbitMQ | Free "Little Lemur" plan (shared) |
| **[Oracle Cloud Always Free](https://www.oracle.com/cloud/free/)** | Full stack on one ARM VM | Run `docker compose` on a free Ampere instance |
| **[Google Cloud free tier](https://cloud.google.com/free)** | e2-micro VM | Run entire compose file on one VM |

**Recommended free combo:** Neon (Postgres) + Upstash (Redis) + CloudAMQP (RabbitMQ) + Fly.io or Render (API). Set connection strings in environment variables instead of self-hosted containers.

### Tier 2 — Hobby / small production ($5–50/mo)

| Platform | Best for | Typical cost |
|----------|----------|--------------|
| **[DigitalOcean Droplet](https://www.digitalocean.com/products/droplet)** | Single VM running full `docker compose` | ~$6–12/mo |
| **[Hetzner Cloud](https://www.hetzner.com/cloud)** | Same as DO; strong price/performance in EU | ~€4–10/mo |
| **[Railway](https://railway.app/)** | Managed Postgres + Redis + API from GitHub | ~$5–20/mo |
| **[Render](https://render.com/)** | Managed Postgres + web service (no cold start on paid) | ~$7–25/mo |
| **[Fly.io](https://fly.io/)** | API + attached volumes | ~$5–15/mo |

**Recommended hobby stack:** One $12/mo VPS with Docker Compose (simplest ops) **or** Railway/Render with managed databases (less ops, slightly higher cost).

### Tier 3 — Production / growth ($50–500+/mo)

| Platform | Components | Notes |
|----------|------------|-------|
| **[AWS](https://aws.amazon.com/)** | ECS Fargate or EKS (API), RDS PostgreSQL, ElastiCache Redis, Amazon MQ (RabbitMQ) | Full control; use Secrets Manager for `JWT_SECRET` |
| **[Google Cloud](https://cloud.google.com/)** | Cloud Run or GKE, Cloud SQL, Memorystore | Good autoscaling on Cloud Run |
| **[Azure](https://azure.microsoft.com/)** | Container Apps or AKS, Azure Database for PostgreSQL, Azure Cache for Redis | Enterprise integrations |
| **[DigitalOcean](https://www.digitalocean.com/)** | App Platform or DOKS, Managed Postgres, Managed Redis | Simpler than big three clouds |
| **[Supabase](https://supabase.com/)** | Postgres (+ optional auth if you replace Identity module later) | Pro from ~$25/mo |

**Recommended production stack (AWS example):**

```
Internet → ALB → ECS Fargate (API, 2+ tasks)
              → RDS PostgreSQL (Multi-AZ)
              → ElastiCache Redis
              → Amazon MQ (RabbitMQ)
Secrets: AWS Secrets Manager (JWT_SECRET, DB passwords)
Logs: CloudWatch
```

### Tier 4 — Scale / enterprise ($500+/mo)

| Need | Options |
|------|---------|
| Multi-region API | Cloudflare + regional ECS/GKE clusters |
| Read replicas | RDS read replicas for catalog-heavy read load |
| Dedicated RabbitMQ cluster | Amazon MQ cluster, CloudAMQP dedicated, or self-managed on K8s |
| CDN for static assets | Cloudflare, Fastly, CloudFront (when you add a frontend) |
| Observability | Datadog, New Relic, Grafana Cloud |

---

## Per-component production mapping

| Local service | Managed alternative (free → paid) | Connection env var |
|---------------|-----------------------------------|--------------------|
| `postgres` | Neon → Supabase → RDS / Cloud SQL | `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` |
| `redis` | Upstash → ElastiCache / Memorystore | `REDIS_URL` |
| `rabbitmq` | CloudAMQP → Amazon MQ | `RABBITMQ_URL` |
| `api` | Fly.io → Render → ECS / Cloud Run / K8s | `PORT`, `JWT_SECRET`, `JWT_EXPIRES_IN` |

---

## Additional tools for a functional production system

These are not in the repo but are expected in real deployments:

### CI/CD

| Tool | Purpose |
|------|---------|
| [GitHub Actions](https://github.com/features/actions) | Build Docker image, run tests, deploy |
| [GitLab CI](https://about.gitlab.com/stages-devops-lifecycle/continuous-integration/) | Same |
| [Argo CD](https://argo-cd.readthedocs.io/) | GitOps deploys to Kubernetes |

Example pipeline steps: `npm ci` → `npm test` → `docker build` → push to registry → deploy → `migration:run`.

### Secrets & config

| Tool | Purpose |
|------|---------|
| [Doppler](https://www.doppler.com/) | Centralized secrets |
| [AWS Secrets Manager](https://aws.amazon.com/secrets-manager/) | Cloud-native secrets |
| [HashiCorp Vault](https://www.vaultproject.io/) | Enterprise secret store |

Never commit production `JWT_SECRET` or database passwords.

### DNS, TLS, edge

| Tool | Purpose |
|------|---------|
| [Cloudflare](https://www.cloudflare.com/) | DNS, DDoS protection, free TLS |
| [Let's Encrypt](https://letsencrypt.org/) | TLS certificates (often via Caddy or cert-manager) |

### Monitoring & alerting

| Tool | Purpose |
|------|---------|
| [Sentry](https://sentry.io/) | Error tracking |
| [Prometheus](https://prometheus.io/) + [Grafana](https://grafana.com/) | Metrics and dashboards |
| [UptimeRobot](https://uptimerobot.com/) | Free uptime checks |
| [PagerDuty](https://www.pagerduty.com/) / [Opsgenie](https://www.atlassian.com/software/opsgenie) | On-call alerts |

### Logging

| Tool | Purpose |
|------|---------|
| [Better Stack](https://betterstack.com/) | Log aggregation (free tier) |
| [AWS CloudWatch Logs](https://aws.amazon.com/cloudwatch/) | If on AWS |
| [Loki](https://grafana.com/oss/loki/) | Self-hosted log store |

### Database operations

| Tool | Purpose |
|------|---------|
| [pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html) | Backups |
| [TypeORM CLI](https://typeorm.io/migrations) | Migrations (`npm run migration:run`) |
| [pgBouncer](https://www.pgbouncer.org/) | Connection pooling at scale |

---

## Environment variables (production checklist)

| Variable | Required | Notes |
|----------|----------|-------|
| `NODE_ENV` | Yes | Set to `production` |
| `PORT` | Yes | Usually `3000` or platform-assigned |
| `POSTGRES_*` | Yes | Use managed DB host in cloud |
| `REDIS_URL` | Yes | `rediss://` if TLS enabled |
| `RABBITMQ_URL` | Yes | `amqps://` if TLS enabled |
| `JWT_SECRET` | Yes | Long random string; rotate with care |
| `JWT_EXPIRES_IN` | No | Default `1h` |

---

## Deployment workflow (summary)

1. **Build:** `docker build -t eshop-api .`
2. **Push:** Tag and push to ECR, GCR, Docker Hub, or GHCR
3. **Migrate:** Run `npm run migration:run` (or the Docker entrypoint command) before or during deploy
4. **Deploy:** Start API with all env vars pointing at managed Postgres, Redis, RabbitMQ
5. **Verify:** `GET /catalog/products`, place a test order, confirm RabbitMQ consumers in logs
6. **Monitor:** Health endpoint, error rate, queue depth in RabbitMQ management UI

---

## Cost estimate (rough monthly)

| Scenario | Components | Est. cost |
|----------|------------|-----------|
| Local dev | Docker on laptop | $0 |
| Free cloud demo | Neon + Upstash + CloudAMQP + Fly.io free | $0 |
| Hobby VPS | 1× 2GB Droplet, full compose | ~$12 |
| Small production | Managed DB + cache + MQ + 2 API instances | ~$80–150 |
| Growth | RDS Multi-AZ + ElastiCache + Amazon MQ + ECS | ~$200–500+ |

---

## Related docs

- [README.md](./README.md) — architecture, curl walkthrough
- [../README.md](../README.md) — full system design series index
