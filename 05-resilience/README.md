# Resilience — Retries, Circuit Breakers, and Fallbacks

Project 5 of the system design series. This one demonstrates **Level 6: Resilience** from [`LEVELS-6-7.md`](../LEVELS-6-7.md): your system keeps working when dependencies fail.

Projects 01–04 teach modular monoliths, sharding, queues, and a capstone that combines them. Project 04 already runs **two API replicas behind Nginx**. Project 03 already implements **broker-level retries and dead-letter queues**. This project focuses on what happens at the **application boundary** when you call an external dependency like Paystack.

## Concept, in my own words

Resilience means assuming failure is normal. Servers crash, networks time out, payment providers have outages. Instead of letting one flaky call take down checkout, you design:

1. **Retries** for transient failures (milliseconds-long blips)
2. **Circuit breakers** to stop hammering a dead service
3. **Fallback providers** (Paystack → Flutterwave)
4. **Graceful degradation** (queue the payment, notify the user later)

Netflix calls this graceful degradation: if recommendations fail, movies should still play.

## What this repo implements

```text
POST /checkout { amount }

↓

Retry Paystack up to 3 times (with delay)

↓

Circuit breaker around Paystack

↓

If still failing → try Flutterwave

↓

If still failing → return queued/cached fallback
```

| Pattern | Where it lives |
|---|---|
| Retry with backoff | `src/resilience/retry.util.ts` |
| Circuit breaker (CLOSED → OPEN → HALF_OPEN) | `src/resilience/circuit-breaker.ts` |
| Flaky Paystack simulator | `src/payment/flaky-payment.gateway.ts` |
| Checkout orchestration | `src/checkout/checkout.service.ts` |

## Run it

> **Hosting & deployment:** See [HOSTING.md](./HOSTING.md) for Docker setup, platforms (free → paid), production tooling, and per-component checklists.

```bash
cp .env.example .env
npm install
npm run start:dev
```

Swagger: `http://localhost:3005/docs`

### Try it

```bash
# Pay several times — watch retries, circuit opening, and fallback
curl -X POST http://localhost:3005/checkout -H 'Content-Type: application/json' -d '{"amount": 5000}'

# Check circuit state
curl http://localhost:3005/checkout/circuit
```

Tune behavior in `.env`:

- `PAYMENT_FAILURE_RATE=0.7` — how often Paystack "times out"
- `CIRCUIT_FAILURE_THRESHOLD=5` — failures before the circuit opens
- `MAX_RETRIES=3` — application-level retries per checkout

## How this maps to Oja

| Oja feature | Resilience approach |
|---|---|
| Paystack checkout | Retry 3×, then queue for background retry |
| Multiple providers | Paystack → Flutterwave fallback |
| Wallet display | Never show divergent balances (see project 06) |
| Email receipts | Already async via RabbitMQ (project 03) |
| API availability | Two replicas + Nginx (project 04) |

## Tests

```bash
npm test
```

Pure unit tests for the circuit breaker live in `src/resilience/circuit-breaker.spec.ts` — no HTTP server required.

## Related projects

| Project | Resilience pattern demonstrated |
|---|---|
| `03-async-queue-processing` | Retry + DLQ at the message broker |
| `04-ecom-marketplace-capstone` | Horizontal replicas + health checks |
| `06-cap-theorem` | Choosing CP vs AP when nodes can't sync |

Full concept write-up: [`LEVELS-6-7.md`](../LEVELS-6-7.md#level-6--resilience)
