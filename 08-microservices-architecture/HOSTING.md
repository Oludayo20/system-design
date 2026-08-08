# Hosting & Deployment Guide — BookHive Microservices

This document covers running the full BookHive stack locally (with Docker) and where each piece
would go in production. For architecture, endpoints, and the curl walkthrough, see
[README.md](./README.md).

---

## Application components

| Component | Role | Required? | Local (Docker) service |
|-----------|------|-----------|-------------------------|
| **Gateway** (Express) | Routes `/auth`, `/books`, `/orders`, `/notifications`; per-IP rate limiting; request logging | Yes | `gateway` |
| **Auth Service** (NestJS) | Register / login / verify, issues JWTs | Yes | `auth-service` |
| **Catalog Service** (NestJS) | Books, stock, atomic stock reservation | Yes | `catalog-service` |
| **Order Service** (NestJS) | Places orders; calls catalog-service (HTTP) and notification-service (HTTP, fire-and-forget) | Yes | `order-service` |
| **Notification Service** (Express) | In-memory log of "sent" notifications | Yes | `notification-service` |
| **auth-db** (PostgreSQL 16) | Owned exclusively by auth-service | Yes | `auth-db` |
| **catalog-db** (PostgreSQL 16) | Owned exclusively by catalog-service | Yes | `catalog-db` |
| **order-db** (PostgreSQL 16) | Owned exclusively by order-service | Yes | `order-db` |

Unlike `01-modular-monolith`, there is no single "the API" — there are 5 independently
deployable HTTP processes and 3 independent databases, none of which share credentials with
each other. That is the whole lesson of this project, so hosting it for real means provisioning
5 deployable units and 3 managed Postgres instances, not one of each.

---

## Prerequisites (your machine)

| Tool | Version | Purpose |
|------|---------|---------|
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | Latest | Run all 8 containers |
| [Docker Compose](https://docs.docker.com/compose/) | v2+ (bundled with Docker Desktop) | Orchestrate the stack |
| [Node.js](https://nodejs.org/) | 20 LTS | Run any one service outside Docker |
| [npm](https://www.npmjs.com/) | 10+ | Install dependencies per service |
| [curl](https://curl.se/) | Any | Exercise the gateway |
| [Git](https://git-scm.com/) | Any | Clone and deploy |

Optional: [jq](https://jqlang.github.io/jq/) for parsing curl responses, [DBeaver](https://dbeaver.io/) for inspecting the three Postgres instances separately (a useful exercise in itself — connect with each service's own credentials and confirm you can't see the other two databases' tables from any single connection).

---

## Run locally with Docker

### 1. Clone and configure

```bash
cd system-design/08-microservices-architecture
cp .env.example .env
```

Review `.env` — it is sectioned by owning service. Change `JWT_SECRET` before any shared use;
every service that verifies tokens (auth, catalog, order) reads this same variable.

### 2. Start the full stack

```bash
docker compose up --build
```

This command:

1. Builds all 5 application images (`gateway`, `auth-service`, `catalog-service`,
   `order-service`, `notification-service`)
2. Pulls `postgres:16-alpine` three times — once per owning service
3. Waits for each Postgres healthcheck before starting its owning service
4. Waits for `auth-service`, `catalog-service`, `order-service`, and `notification-service` to
   report healthy before starting `gateway`

**First run** may take a few minutes (5 separate `npm ci` build stages + 3 Postgres image pulls).
This project needs several GB of free RAM, similar to `04-ecom-marketplace-capstone`.

### 3. Verify services

| Service | URL | Notes |
|---------|-----|-------|
| Gateway | http://localhost:3008/health | Intended entry point |
| Auth Service + Swagger | http://localhost:4001/docs | Direct access for debugging |
| Catalog Service + Swagger | http://localhost:4002/docs | Direct access for debugging |
| Order Service + Swagger | http://localhost:4003/docs | Direct access for debugging |
| Notification Service | http://localhost:4004/notifications | Direct access for debugging |
| auth-db | `localhost:5436` | `bookhive` / `bookhive_dev_password` / db `auth_db` |
| catalog-db | `localhost:5437` | `bookhive` / `bookhive_dev_password` / db `catalog_db` |
| order-db | `localhost:5438` | `bookhive` / `bookhive_dev_password` / db `order_db` |

```bash
# Quick health check through the gateway
curl -s http://localhost:3008/health

# Follow one service's logs
docker compose logs -f order-service
```

### 4. Stop and reset

```bash
# Stop containers, keep data
docker compose down

# Stop and delete volumes (fresh databases)
docker compose down -v
```

### Troubleshooting Docker

| Problem | Fix |
|---------|-----|
| Ports 3008/4001-4004/5436-5438 already in use | Stop conflicting services or change host ports in `docker-compose.yml` / `.env` |
| A service exits waiting on its DB | `docker compose logs <service>-db`; confirm the healthcheck passed before the service started |
| `order-service` orders fail with 502 | `catalog-service` is unreachable — check `docker compose ps catalog-service` |
| Docker daemon not running | Start Docker Desktop |

---

## Hosting platforms (free → paid)

The interesting difference from a monolith: every row below can be sized, scaled, and deployed
**independently** per service. A small BookHive deployment would run `notification-service` on
the cheapest possible tier and `catalog-service` on something beefier, because that's genuinely
where the read traffic goes.

### Tier 1 — Free / learning & demos

| Platform | What to host | Notes |
|----------|--------------|-------|
| **[Fly.io](https://fly.io/)** | Any one service | Free allowance; deploy each service's Dockerfile separately |
| **[Render](https://render.com/)** | Any one service (free web service) | Spins down after inactivity per-service |
| **[Railway](https://railway.app/)** | Multiple services + Postgres add-ons | Trial credits; each service is its own Railway service |
| **[Neon](https://neon.tech/)** | Each Postgres database | Provision 3 separate free Neon projects — one per service, matching the "own database" rule |

**Recommended free combo:** three separate free Neon Postgres projects (`auth`, `catalog`,
`order`) + Fly.io or Render for each of the 5 app services, each with only the env vars it needs.

### Tier 2 — Hobby / small production ($15–80/mo)

| Platform | Best for | Typical cost |
|----------|----------|--------------|
| **[Railway](https://railway.app/)** | All 5 services + 3 managed Postgres from one dashboard | ~$20–50/mo |
| **[Render](https://render.com/)** | 5 web services + 3 managed Postgres | ~$35–80/mo |
| **[DigitalOcean Droplet](https://www.digitalocean.com/products/droplet)** | One VM running the whole `docker compose` stack (simplest ops, least "real" microservices) | ~$12–24/mo |

**Recommended hobby stack:** Railway — it's the platform in this tier that makes "deploy just
`notification-service`" a first-class action instead of an SSH session.

### Tier 3 — Production / growth ($100–800+/mo)

| Platform | Components | Notes |
|----------|------------|-------|
| **[AWS](https://aws.amazon.com/)** | ECS Fargate service per app (5 task definitions), RDS PostgreSQL × 3, ALB or API Gateway in front | Each service gets its own IAM role — the enforcement mechanism for "no shared DB creds" carries over from Docker env isolation to IAM policy |
| **[Google Cloud Run](https://cloud.google.com/run)** | One Cloud Run service per app, Cloud SQL × 3 | Scales each service to zero independently — the clearest real-world version of "independent scaling" |
| **[Kubernetes (EKS/GKE/AKS)](https://kubernetes.io/)** | One Deployment + Service per app, HPA per Deployment, 3 managed Postgres | Where `--scale catalog-service=3` becomes `kubectl scale deployment/catalog-service --replicas=3` with a real Service/Ingress in front, no host-port caveat |

**Recommended production stack (Cloud Run example):**

```
Internet → API Gateway (Cloud Run: gateway)
              → Cloud Run: auth-service    → Cloud SQL (auth)
              → Cloud Run: catalog-service  → Cloud SQL (catalog)
              → Cloud Run: order-service    → Cloud SQL (order)
              → Cloud Run: notification-service (no DB)
Secrets: Secret Manager (JWT_SECRET, one per DB password)
Logs: Cloud Logging, one log stream per service
```

### Tier 4 — Scale / enterprise ($800+/mo)

| Need | Options |
|------|---------|
| Service mesh (mTLS between services, retries, circuit breaking at the infra layer) | Istio, Linkerd |
| API Gateway replacing the hand-rolled Express one | Kong, AWS API Gateway, Apigee |
| Async instead of fire-and-forget HTTP for notifications | RabbitMQ/SQS — see `03-async-queue-processing` |
| Multi-region | Regional deployments per service behind a global load balancer |
| Observability across 5 services | Datadog APM / Honeycomb with a correlation ID propagated from the gateway |

---

## Per-component production mapping

| Local service | Managed alternative (free → paid) | Connection env var(s) |
|---------------|-----------------------------------|------------------------|
| `auth-db` | Neon → Supabase → RDS/Cloud SQL | `AUTH_DB_*` |
| `catalog-db` | Neon → Supabase → RDS/Cloud SQL | `CATALOG_DB_*` |
| `order-db` | Neon → Supabase → RDS/Cloud SQL | `ORDER_DB_*` |
| `gateway` | Fly.io → Render → Cloud Run / ECS / API Gateway | `PORT`, `*_SERVICE_URL`, `RATE_LIMIT_*` |
| `auth-service` | Fly.io → Render → Cloud Run / ECS | `PORT`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `AUTH_DB_*` |
| `catalog-service` | Fly.io → Render → Cloud Run / ECS | `PORT`, `JWT_SECRET`, `CATALOG_DB_*` |
| `order-service` | Fly.io → Render → Cloud Run / ECS | `PORT`, `JWT_SECRET`, `ORDER_DB_*`, `CATALOG_SERVICE_URL`, `NOTIFICATION_SERVICE_URL` |
| `notification-service` | Fly.io → Render → Cloud Run / ECS | `PORT` only |

---

## Additional tools for a functional production system

### CI/CD

| Tool | Purpose |
|------|---------|
| [GitHub Actions](https://github.com/features/actions) | One workflow per service (or a matrix job) — `npm ci && npm run build && npm test` → build & push image → deploy just that service |
| [Argo CD](https://argo-cd.readthedocs.io/) | GitOps deploys to Kubernetes, one Application manifest per service |

Independent deployability (the README's "fix a bug in notification-service" example) only pays
off in CI if the pipeline itself is scoped per service — a monorepo CI job that rebuilds and
redeploys all 5 services on every commit throws the benefit away.

### Secrets & config

| Tool | Purpose |
|------|---------|
| [Doppler](https://www.doppler.com/) | Centralized secrets, scoped per service |
| [AWS Secrets Manager](https://aws.amazon.com/secrets-manager/) / [GCP Secret Manager](https://cloud.google.com/secret-manager) | Cloud-native secrets — give each service IAM access to only its own DB secret |

Never commit `JWT_SECRET` or any `*_DB_PASSWORD`. In production, rotate `JWT_SECRET` with a
grace period (accept both old and new for a window) since it's shared across three services that
can't all redeploy atomically.

### Monitoring & alerting

| Tool | Purpose |
|------|---------|
| [Sentry](https://sentry.io/) | Error tracking — one project per service, or one project with service tags |
| [Prometheus](https://prometheus.io/) + [Grafana](https://grafana.com/) | Per-service metrics (request rate, error rate, latency) |
| [UptimeRobot](https://uptimerobot.com/) | Free uptime checks on each service's `/health` |
| [PagerDuty](https://www.pagerduty.com/) | Alert when a service's healthcheck fails |

### Logging / tracing

| Tool | Purpose |
|------|---------|
| [Better Stack](https://betterstack.com/) / [Loki](https://grafana.com/oss/loki/) | Aggregate logs across all 5 services into one searchable place |
| [OpenTelemetry](https://opentelemetry.io/) | Propagate a correlation ID from `gateway` through every downstream call, so one customer request can be followed across processes |

### Database operations

| Tool | Purpose |
|------|---------|
| [pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html) | Backups — run separately per database, they're on separate instances |
| [TypeORM](https://typeorm.io/) | Schema (this demo uses `synchronize: true` per service; production would add migrations per service, each with its own migration history) |

---

## Environment variables (production checklist)

| Variable | Required by | Notes |
|----------|-------------|-------|
| `JWT_SECRET` | gateway (n/a), auth/catalog/order-service | Long random string; shared across exactly these three |
| `JWT_EXPIRES_IN` | auth-service (issues), catalog/order (verify only) | Default `1h` |
| `AUTH_DB_*` | auth-service only | Never appears in any other service's environment |
| `CATALOG_DB_*` | catalog-service only | Never appears in any other service's environment |
| `ORDER_DB_*` | order-service only | Never appears in any other service's environment |
| `*_SERVICE_URL` | gateway, order-service | Internal network addresses, not credentials |
| `RATE_LIMIT_CAPACITY` / `RATE_LIMIT_REFILL_PER_SEC` | gateway | Tune per expected traffic |
| `NOTIFICATION_TIMEOUT_MS` | order-service | Fault-isolation budget for the fire-and-forget call |

---

## Deployment workflow (summary)

1. **Build:** `docker build -t bookhive-<service> ./<service>` per changed service
2. **Push:** Tag and push to ECR/GCR/Docker Hub/GHCR, one image per service
3. **Deploy:** Redeploy only the changed service(s) with env vars pointing at its managed
   database and the other services' URLs
4. **Verify:** Hit that service's `/health`, then run the README's curl walkthrough end to end
   through the gateway
5. **Monitor:** Per-service health endpoint, error rate, and (if wired up) the correlation ID
   trail across services for a sample request

---

## Cost estimate (rough monthly)

| Scenario | Components | Est. cost |
|----------|------------|-----------|
| Local dev | Docker on laptop | $0 |
| Free cloud demo | 3× Neon free + 5× Fly.io/Render free | $0 |
| Hobby | Railway, all 8 components | ~$20–50 |
| Small production | Render/Railway managed, 5 services + 3 DBs | ~$80–150 |
| Growth | AWS ECS/Cloud Run + RDS/Cloud SQL × 3, autoscaled | ~$300–800+ |

---

## Related docs

- [README.md](./README.md) — architecture, endpoint table, curl walkthrough
- [../04-ecom-marketplace-capstone/HOSTING.md](../04-ecom-marketplace-capstone/HOSTING.md) — the modular-monolith alternative to this same feature set
- [../README.md](../README.md) — full system design series index
