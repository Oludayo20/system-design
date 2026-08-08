# Hosting & Deployment Guide — Serverless Emulator Demo

This document covers how to run the serverless emulator locally (including Docker) and where to
host it — plus, since this project's whole point is to teach concepts you'd normally run on a
real FaaS platform, what it would take to run the *real* thing instead.

For the emulator's mechanics (cold starts, scale-to-zero, billing, triggers), see
[README.md](./README.md).

---

## Application components

| Component | Role | Required? | Notes |
|-----------|------|-----------|-------|
| **Express API** (`api` service) | HTTP trigger (`apiGateway`), file-drop simulation, `/_runtime/stats`, schedule trigger, queue trigger | Yes | Port `3010` by default |
| **Execution-environment manager** | Warm pool, cold-start simulation, TTL sweeper, billing | Yes | In-process, no external dependency |
| **RabbitMQ** (`rabbitmq` service) | Backs the queue trigger only (simulates SQS → Lambda) | Yes, for the queue-trigger demo | Own container — not shared with `03-async-queue-processing`'s RabbitMQ |

No PostgreSQL — the order store is an in-memory Map (see the comment in `store/order-store.ts`
for why that's an acceptable stand-in for a real backing store in this demo).

---

## Prerequisites (your machine)

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 20 LTS | Run the API |
| npm | 10+ | Install, build, test |
| Docker Desktop | Latest | Containerized run (recommended — brings RabbitMQ along) |
| curl | Any | Exercise the HTTP triggers |

---

## Run locally with Docker

### Quick start

```bash
cd system-design/10-serverless-architecture
cp .env.example .env
docker compose up --build -d
```

| Endpoint | URL |
|----------|-----|
| Create order (HTTP trigger) | `POST http://localhost:3010/orders` |
| Simulated S3 upload (file-drop trigger) | `POST http://localhost:3010/_simulate/s3-upload` |
| Publish a payment burst (feeds the queue trigger) | `POST http://localhost:3010/_simulate/payment-burst` |
| Runtime stats | `GET http://localhost:3010/_runtime/stats` |
| Health check | `GET http://localhost:3010/healthz` |
| RabbitMQ management UI | http://localhost:15673 (user/pass from `.env`) |

See [README.md](./README.md#try-it--prove-the-cold-start) for the full walkthrough with expected
output.

### Tune behavior in `.env`

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3010` | HTTP port |
| `WARM_TTL_MS` | `60000` | How long an idle instance stays warm before the sweeper evicts it |
| `COLD_START_LATENCY_MS` | `400` | Real injected cold-start delay |
| `SCHEDULE_INTERVAL_MS` | `30000` | How often the schedule trigger fires `dailySalesReport` |
| `RABBITMQ_URL` | `amqp://serverless_demo:serverless_demo_password@localhost:5673` | Queue trigger connection (inside Docker, the `api` service uses `rabbitmq:5672` instead — set automatically in `docker-compose.yml`) |

Lower `WARM_TTL_MS` (e.g. `8000`) before a live demo so the cold → warm → cold cycle doesn't
require a full minute of waiting.

### Run without Docker

RabbitMQ still needs to run somewhere for the queue trigger — either point `RABBITMQ_URL` at a
RabbitMQ you already have, or run just that one service from this project's compose file:

```bash
docker compose up -d rabbitmq
cp .env.example .env   # RABBITMQ_URL already points at localhost:5673
npm install
npm run build
npm start
# or, for a watch-mode dev loop:
npm run start:dev
```

If RabbitMQ isn't reachable, the API still starts — the HTTP and schedule triggers work fine, and
the queue trigger logs a warning and stays disabled (see `main.ts`'s `bootstrap()` — RabbitMQ
connection failure doesn't block the rest of the app, deliberately).

### Stop

```bash
docker compose down -v
```

---

## Hosting platforms (free → paid) — for the emulator itself

This is a demo/teaching project, not something you'd put in front of real traffic, but if you
wanted a shareable link:

### Tier 1 — Free

| Platform | Notes |
|----------|-------|
| **[Render](https://render.com/)** free web service + free RabbitMQ isn't available there — swap to [CloudAMQP](https://www.cloudamqp.com/)'s free "Little Lemur" plan for the queue trigger | Spins down when idle (which will itself demonstrate scale-to-zero at the *hosting* layer, on top of the emulator's own) |
| **[Fly.io](https://fly.io/)** | Deploy the Dockerfile; add a RabbitMQ app or use CloudAMQP |
| **[Railway](https://railway.app/)** | Has a one-click RabbitMQ template |

### Tier 2 — Hobby ($0–10/mo)

| Platform | Est. cost |
|----------|-----------|
| Render paid starter + CloudAMQP free tier | ~$7/mo |
| Fly.io shared CPU + Fly RabbitMQ app | ~$5–8/mo |

### Tier 3 — What this project is actually teaching you to reach for

If you wanted the *real* mechanics this project simulates, you'd stop running your own runtime
and adopt an actual FaaS platform:

| This demo's stand-in | Real equivalent | Notes |
|---|---|---|
| `apiGateway` HTTP trigger | Amazon API Gateway (or AWS Lambda Function URLs) | Routes HTTP requests to Lambda invocations |
| Schedule trigger (`setInterval`) | Amazon EventBridge scheduled rule (`rate(...)` / cron) | Real cron expression support, no process needs to stay running |
| Queue trigger (RabbitMQ consumer) | Amazon SQS → Lambda event source mapping | AWS manages the poller and concurrency scaling for you |
| File-drop trigger (`_simulate/s3-upload`) | Amazon S3 `ObjectCreated` event notification → Lambda | No polling needed — S3 invokes Lambda directly |
| `functions/*.ts` handler files | Deployed as-is via AWS SAM, Serverless Framework, or the AWS CDK | Because the handlers have zero framework code, they'd need **no changes** to actually deploy — only the trigger wiring (API Gateway routes, EventBridge rules, SQS mappings, S3 notifications) is new |
| Execution-environment manager | AWS Lambda's own control plane | Cold starts, scale-to-zero, concurrency scaling, and per-100ms (historically) / per-ms (current) billing are all real AWS mechanics — this project reimplements a simplified version of them for a local, no-account, no-cost learning environment |

### Tier 4 — Enterprise

- Provisioned concurrency (pre-warmed Lambda instances, eliminating cold starts for latency-
  sensitive paths, at a flat hourly cost)
- Multi-region Lambda@Edge / CloudFront Functions for edge invocation
- Step Functions for orchestrating many functions into a workflow
- Observability: AWS X-Ray traces per invocation, CloudWatch Lambda Insights

---

## Tools needed for a functional deployment

### Required (this project)

| Tool | Purpose |
|------|---------|
| Node.js 20 or Docker | Runtime |
| RabbitMQ | Queue trigger backend |
| `.env` | Tune TTL/cold-start/schedule timings for demos |

### Required if porting these patterns to real AWS Lambda

| Tool | Purpose |
|------|---------|
| AWS SAM CLI or Serverless Framework | Package and deploy `functions/*.ts` as real Lambdas |
| API Gateway / Function URLs | Real HTTP trigger |
| EventBridge | Real schedule trigger |
| SQS | Real queue trigger |
| S3 event notifications | Real file-drop trigger |
| DynamoDB or RDS | Replace the in-memory order store — Lambda execution environments are ephemeral, so state must live outside the function |

### CI/CD

| Tool | Purpose |
|------|---------|
| GitHub Actions | `npm test` → `npm run build` → `docker build` |
| Unit tests | `npm test` — execution-environment-manager specs need no server |

### Observability

| Tool | Purpose |
|------|---------|
| Structured logging | Already logs cold/warm, billed ms, and sweeper evictions per invocation |
| Metrics | `GET /_runtime/stats` is the demo equivalent of CloudWatch Lambda metrics |
| Distributed tracing | AWS X-Ray in a real deployment; not implemented here |

---

## Environment variables (reference)

| Variable | Purpose |
|----------|---------|
| `PORT` | HTTP port for the `apiGateway` trigger and `_runtime`/`_simulate` endpoints |
| `WARM_TTL_MS` | Idle time before an instance is scaled to zero |
| `COLD_START_LATENCY_MS` | Real injected cold-start delay |
| `SCHEDULE_INTERVAL_MS` | Interval between `dailySalesReport` invocations |
| `RABBITMQ_URL` | Queue trigger connection string |
| `RABBITMQ_USER` / `RABBITMQ_PASSWORD` | Used by `docker-compose.yml` to configure the `rabbitmq` service and build the default `RABBITMQ_URL` |

---

## Cost estimate

| Scenario | Est. cost |
|----------|-----------|
| Local / Docker | $0 |
| Fly.io / Render free + CloudAMQP free | $0 |
| Paid always-on hobby | ~$5–10/mo |
| Real AWS Lambda (per the Tier 3 mapping above), light demo traffic | Likely within the AWS free tier (1M requests/month, 400,000 GB-seconds/month) |

---

## Related docs

- [README.md](./README.md) — concept explanation and full "Try it" walkthrough
- [../05-resilience/HOSTING.md](../05-resilience/HOSTING.md) — same honest-simulation approach, different concept
- [../03-async-queue-processing/HOSTING.md](../03-async-queue-processing/HOSTING.md) — the long-running-worker alternative to a queue-triggered function
