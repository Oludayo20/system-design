# Hosting & Deployment Guide — Resilience Demo

This document covers how to run the resilience patterns demo locally (including Docker) and where to host it in production. This project is a **single stateless NestJS API** with an in-memory flaky payment simulator — no database or message broker required.

For retry, circuit breaker, and fallback behavior, see [README.md](./README.md).

---

## Application components

| Component | Role | Required? | Notes |
|-----------|------|-----------|-------|
| **NestJS API** | `POST /checkout`, `GET /checkout/circuit` | Yes | Port `3005` by default |
| **In-memory payment gateway** | Simulates flaky Paystack + Flutterwave fallback | Yes | No external API keys |
| **Circuit breaker** | CLOSED → OPEN → HALF_OPEN state machine | Yes | In-process |
| **Retry logic** | Application-level retries with delay | Yes | Configurable via `.env` |

No PostgreSQL, Redis, RabbitMQ, or load balancer — this is intentionally minimal so you can focus on application-boundary resilience.

---

## Prerequisites (your machine)

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 20 LTS | Run API |
| npm | 10+ | Install, build, test |
| Docker Desktop | Latest | Optional — containerized run |
| curl | Any | Exercise checkout endpoint |

---

## Run locally with Docker

### Quick start

```bash
cd system-design/05-resilience
cp .env.example .env
docker compose up --build
```

API available at:

| Endpoint | URL |
|----------|-----|
| Swagger | http://localhost:3005/docs |
| Checkout | `POST http://localhost:3005/checkout` |
| Circuit state | `GET http://localhost:3005/checkout/circuit` |

### Try it

```bash
# Run checkout several times — observe retries, circuit open, Flutterwave fallback
curl -X POST http://localhost:3005/checkout \
  -H 'Content-Type: application/json' \
  -d '{"amount": 5000}'

curl http://localhost:3005/checkout/circuit
```

### Tune behavior in `.env`

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3005` | HTTP port |
| `PAYMENT_FAILURE_RATE` | `0.7` | How often primary provider "fails" |
| `CIRCUIT_FAILURE_THRESHOLD` | `5` | Failures before circuit opens |
| `CIRCUIT_RESET_MS` | `10000` | Time before half-open probe |
| `MAX_RETRIES` | `3` | Retries per checkout attempt |
| `RETRY_DELAY_MS` | `200` | Delay between retries |

### Run without Docker (hot reload)

```bash
cp .env.example .env
npm install
npm run start:dev
```

### Stop

```bash
docker compose down
```

---

## Hosting platforms (free → paid)

Because this app is stateless and has no external dependencies, it is the **cheapest project in the series to host**.

### Tier 1 — Free

| Platform | Notes |
|----------|-------|
| **[Render](https://render.com/)** free web service | Spins down when idle |
| **[Fly.io](https://fly.io/)** | Free allowance; deploy Dockerfile |
| **[Railway](https://railway.app/)** | Trial credits |
| **[Vercel](https://vercel.com/)** | Serverless Nest adapter possible; overkill for demo |
| **[Glitch](https://glitch.com/)** | Quick shareable demo |

**Recommended free:** Fly.io or Render — push Docker image, set env vars, done.

### Tier 2 — Hobby ($0–7/mo)

| Platform | Est. cost |
|----------|-----------|
| Render paid starter | ~$7/mo (no cold start) |
| Fly.io shared CPU | ~$3–5/mo |
| DigitalOcean App Platform | ~$5/mo |

### Tier 3 — Production context

This demo is **not** a standalone production service — it teaches patterns you embed in real apps (e.g. the Oja capstone checkout flow). In production:

| Pattern | Where it lives |
|---------|----------------|
| Retry + circuit breaker on Paystack | Payment module inside `04-ecom-marketplace-capstone` API |
| Broker-level retry/DLQ | `03-async-queue-processing` RabbitMQ topology |
| Multi-replica availability | `04` Nginx + 2 API instances |

Host the **parent application** (modular monolith), not this demo alone.

### Tier 4 — Enterprise

- Service mesh circuit breaking (Istio, Linkerd)
- [Resilience4j](https://github.com/resilience4j/resilience4j)-style policies at gateway
- Multi-provider payment routing with observability (Datadog APM)

---

## Tools needed for a functional deployment

### Required (this project)

| Tool | Purpose |
|------|---------|
| Node.js 20 or Docker | Runtime |
| `.env` | Tune failure rates for demos |

### Required when integrating into Oja/production

| Tool | Purpose |
|------|---------|
| **Real payment SDKs** | Paystack, Flutterwave official APIs |
| **Secrets Manager** | API keys — never in `.env` in prod |
| **PostgreSQL** | Persist checkout/payment state |
| **RabbitMQ / SQS** | Queue failed payments for background retry |
| **Idempotency keys** | Prevent double charges on retry |

### CI/CD

| Tool | Purpose |
|------|---------|
| GitHub Actions | `npm test` → `docker build` → deploy |
| Unit tests | `npm test` — circuit breaker specs need no server |

### Observability

| Tool | Purpose |
|------|---------|
| Structured logging | Log circuit state transitions |
| Metrics | `checkout_success_total`, `circuit_open_total` |
| Sentry | Capture unhandled payment errors |
| PagerDuty | Alert when circuit stays OPEN > N minutes |

### Load testing

| Tool | Purpose |
|------|---------|
| k6 / hey | Hammer `/checkout` to force circuit open |
| Chaos engineering | [Gremlin](https://www.gremlin.com/), [Litmus](https://litmuschaos.io/) — inject provider failures |

---

## Environment variables (production checklist)

When porting patterns to a real payment service:

| Variable | Purpose |
|----------|---------|
| `PAYSTACK_SECRET_KEY` | Real provider (secrets manager) |
| `FLUTTERWAVE_SECRET_KEY` | Fallback provider |
| `CIRCUIT_FAILURE_THRESHOLD` | Tune per provider SLO |
| `MAX_RETRIES` | Only for idempotent operations |
| `WEBHOOK_SECRET` | Verify provider callbacks |

---

## Mapping to full stack hosting

| This demo | In Oja capstone (`04`) |
|-----------|------------------------|
| In-memory Paystack | Replace with HTTP client + circuit breaker wrapper |
| Single instance | 2+ replicas behind Nginx; circuit breaker is **per process** — use shared state (Redis) for cluster-wide circuit if needed |
| Queued fallback response | Publish to RabbitMQ `payment.retry` queue (`03` pattern) |

---

## Cost estimate

| Scenario | Est. cost |
|----------|-----------|
| Local / Docker | $0 |
| Fly.io / Render free | $0 |
| Paid always-on hobby | ~$5–7/mo |

---

## Related docs

- [README.md](./README.md) — pattern explanation
- [../LEVELS-6-7.md](../LEVELS-6-7.md) — Level 6 resilience concepts
- [../04-ecom-marketplace-capstone/HOSTING.md](../04-ecom-marketplace-capstone/HOSTING.md) — where to deploy real checkout
- [../03-async-queue-processing/HOSTING.md](../03-async-queue-processing/HOSTING.md) — async retry via message broker
