# Orbit — Hexagonal Architecture (Ports & Adapters)

Project 12 of the system design series. This one demonstrates **Hexagonal Architecture**
(a.k.a. Ports & Adapters): the core business logic must not depend on any framework, database,
or external API. Instead the core defines **ports** (interfaces) describing what it needs, and
**adapters** (implementations) plug into those ports from the outside.

Domain: **Orbit**, a subscription billing service. Plans are `basic`, `pro`, `enterprise`;
customers can subscribe, upgrade, downgrade, and cancel.

## Concept, in my own words

In a typical layered app, the "business logic" layer imports its database layer directly —
`OrderService` imports `OrderRepository`, which imports `TypeOrmModule`. The business logic
*depends on* infrastructure. That's convenient until you want to unit test a business rule
without spinning up Postgres, or swap a payment provider, and suddenly the business logic and
the infrastructure are welded together.

Hexagonal architecture inverts that dependency. The core (`src/core`) defines **interfaces** for
everything it needs from the outside world — `SubscriptionRepositoryPort`, `PaymentGatewayPort`,
`NotifierPort` — and never imports a concrete implementation of any of them. Infrastructure code
(Postgres, Stripe, a REST controller) then depends on the core's interfaces, not the other way
around. This is **dependency inversion**: the arrows that used to point "core → infrastructure"
now point "infrastructure → core."

Two kinds of adapters plug into the hexagon from opposite sides:

- **Inbound / driving adapters** call *into* the core through **input ports** (`SubscribePort`,
  `ChangePlanPort`, `CancelPort`, `GetSubscriptionPort`). In this project: a REST controller and
  a CLI.
- **Outbound / driven adapters** are called *by* the core through **output ports**
  (`SubscriptionRepositoryPort`, `PaymentGatewayPort`, `NotifierPort`) that the core itself
  defines. In this project: a Postgres repository and an in-memory repository (same port, either
  one), and a Stripe mock and a Flutterwave mock (same port, either one).

The payoff, demonstrated for real in this repo rather than just claimed:

1. You can swap Postgres for an in-memory store without touching the core — one env var.
2. You can swap payment providers without touching the core — one env var.
3. You can unit-test the core with zero DB and zero network by injecting fake adapters —
   see [`src/core/application/*.spec.ts`](./src/core/application).

## Diagram

```text
                              INBOUND / DRIVING                    OUTBOUND / DRIVEN
                              (call INTO the core)                 (called BY the core)

                        ┌──────────────────┐                 ┌──────────────────────────┐
                        │  REST controller  │                 │  PostgresSubscription     │
                        │  (subscription.    │                 │  Repository (TypeORM)     │
                        │   controller.ts)   │                 │      — or —                │
                        └─────────┬──────────┘                 │  InMemorySubscription      │
                                  │                             │  Repository                │
                        ┌──────────────────┐                   └─────────────▲──────────────┘
                        │   Orbit CLI        │                               │
                        │  (orbit-cli.ts)    │                               │ implements
                        └─────────┬──────────┘                               │
                                  │ calls                     ┌──────────────┴──────────────┐
                                  │                            │ SubscriptionRepositoryPort  │
                                  ▼                            └──────────────▲──────────────┘
              ┌─────────────────────────────────────────────────────────────┐│
              │                                                             ││
   in ports   │        ╔═════════════════════════════════════════╗         ││   out ports
  (SubscribePort,       ║              CORE (src/core)             ║        │(SubscriptionRepositoryPort,
   ChangePlanPort,      ║                                           ║        │ PaymentGatewayPort,
   CancelPort,          ║   domain/        subscription.ts          ║        │ NotifierPort)
   GetSubscriptionPort) ║                  plan.ts                  ║        │
              │         ║                  billing-cycle.ts         ║        │
              │         ║                                           ║        │
              │         ║   application/   subscribe.use-case.ts    ║────────┘ calls out through
              │         ║                  change-plan.use-case.ts  ║          the port interfaces
              │         ║                  cancel.use-case.ts       ║
              │         ║                                           ║────────┐
              │         ║   ZERO framework imports anywhere here    ║        │ calls out through
              │         ╚═══════════════════════════════════════════╝        │ the port interfaces
              └─────────────────────────────────────────────────────────────┘│
                                                                               ▼
                                                          ┌──────────────────────────┐
                                                          │ PaymentGatewayPort        │
                                                          │ NotifierPort              │
                                                          └─────────────▲──────────────┘
                                                                        │ implements
                                                     ┌──────────────────┴──────────────────┐
                                                     │  StripeMockAdapter                    │
                                                     │      — or —                           │
                                                     │  FlutterwaveMockAdapter                │
                                                     │                                        │
                                                     │  ConsoleNotifierAdapter                │
                                                     └────────────────────────────────────────┘
```

The core sits in the middle knowing nothing about REST, CLI, Postgres, TypeORM, Stripe, or
Flutterwave — only about the **shapes** of the ports it defined for itself. Everything outside
the double-lined box is replaceable.

## What's in each folder

```text
src/
  core/                          # ZERO framework imports anywhere in this folder
    domain/
      subscription.ts             # pure class + all 4 business rules
      plan.ts                     # plan catalog (basic/pro/enterprise) + price lookup
      billing-cycle.ts            # proration math, pure functions
    ports/
      in/                         # input ports — what use cases the core exposes
      out/                        # output ports — what the core needs from the outside
    application/
      subscribe.use-case.ts       # implements the in ports by orchestrating the out ports
      change-plan.use-case.ts     #  — this is where the four business rules get exercised
      cancel.use-case.ts
      get-subscription.use-case.ts
  adapters/
    in/
      http/                        # inbound adapter #1: REST controller + DTOs
      cli/                         # inbound adapter #2: orbit-cli.ts
    out/
      persistence/                 # outbound adapter: Postgres repo + in-memory repo (same port)
      payment/                     # outbound adapter: Stripe mock + Flutterwave mock (same port)
      notification/                # outbound adapter: console notifier
  app.module.ts                    # wires REPOSITORY / PAYMENT_PROVIDER env vars to port tokens
  main.ts
```

## Business rules (all four live only in `src/core`)

1. **Downgrade rejected mid-cycle** — `Subscription.previewPlanChange()` throws
   `DowngradeNotAllowedMidCycleError` if the new plan is cheaper than the current one and the
   current billing period (`currentPeriodEnd`) hasn't ended yet.
2. **Upgrade prorated immediately** — an upgrade mid-cycle is allowed and triggers an immediate
   charge: `(newPrice - oldPrice) * daysRemaining / daysInPeriod`, rounded to 2 decimals. See
   [`billing-cycle.ts`](./src/core/domain/billing-cycle.ts) `computeProration()`.
3. **Cancel schedules, doesn't delete** — `Subscription.cancel()` sets `cancelAtPeriodEnd = true`;
   nothing is deleted or deactivated immediately, and the subscription stays active until
   `currentPeriodEnd`.
4. **One active subscription per customer** — `SubscribeUseCase` rejects a new subscription with
   `CustomerAlreadySubscribedError` if the customer already has one that's still active.

## Run it

> **Hosting & deployment:** See [HOSTING.md](./HOSTING.md) for Docker setup, platforms, and
> per-component checklists.

```bash
cp .env.example .env
npm install
npm run start:dev
```

Swagger: `http://localhost:3012/docs` — the page header shows which adapters are active
(`REPOSITORY=...`, `PAYMENT_PROVIDER=...`).

### Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/subscriptions` | Subscribe a customer to a plan (charges the plan price) |
| `POST` | `/subscriptions/:id/change-plan` | Upgrade (prorated charge) or attempt a downgrade (rejected mid-cycle) |
| `POST` | `/subscriptions/:id/cancel` | Schedule cancellation at period end |
| `GET` | `/subscriptions/:id` | Read a subscription |

## Swap a database — the actual walkthrough

Default is `REPOSITORY=memory` (no DB needed). To swap to Postgres:

```bash
# in .env
REPOSITORY=postgres
```

Restart the app (`npm run start:dev`, or `docker compose up` if using Docker — see HOSTING.md).
That's it. **The file that changes is `.env`. The number of files inside `src/core` that change
is zero** — verify it yourself:

```bash
grep -rl "REPOSITORY" src/core   # no results — src/core has never heard of this env var
```

The only code involved is `src/app.module.ts`, which reads `REPOSITORY` and binds
`SUBSCRIPTION_REPOSITORY_PORT` to either `PostgresSubscriptionRepository` (TypeORM,
`src/adapters/out/persistence/postgres-subscription.repository.ts`) or
`InMemorySubscriptionRepository` (a `Map`,
`src/adapters/out/persistence/in-memory-subscription.repository.ts`) — both implement the exact
same `SubscriptionRepositoryPort` interface the core defined.

## Swap a payment provider — the actual walkthrough

Default is `PAYMENT_PROVIDER=stripe`. To swap:

```bash
# in .env
PAYMENT_PROVIDER=flutterwave
```

Restart the app. Again, zero files inside `src/core` change — `app.module.ts` binds
`PAYMENT_GATEWAY_PORT` to either `StripeMockAdapter` or `FlutterwaveMockAdapter`
(`src/adapters/out/payment/`), both implementing `PaymentGatewayPort`. Both are simulated (small
random latency, small *deterministic* failure rate so demos are reproducible) — neither calls a
real external API.

## Proof: CLI and HTTP both drive the same core

The REST controller and the CLI construct and call the exact same use-case classes
(`SubscribeUseCase`, `ChangePlanUseCase`, `CancelUseCase`, `GetSubscriptionUseCase`) from
`src/core/application`. Point them at the same database and you get identical behavior from two
different front doors.

**Via curl (HTTP adapter):**

```bash
curl -s -X POST http://localhost:3012/subscriptions \
  -H 'Content-Type: application/json' \
  -d '{"customerId": "cust-http-1", "planId": "basic"}'
```

**Via the CLI (same use case, same rules), pointed at the same Postgres database** (e.g. the one
exposed by `docker compose` on `localhost:5432` — see HOSTING.md):

```bash
REPOSITORY=postgres POSTGRES_HOST=localhost \
  npm run cli -- subscribe --customer cust-cli-1 --plan basic
```

Both produce a subscription with the same shape (`id`, `customerId`, `planId`,
`currentPeriodStart`, `currentPeriodEnd`, `cancelAtPeriodEnd`), enforce the same four business
rules, and — when pointed at the same database — write to the same `subscriptions` table. Fetch
a subscription created via curl back out through the CLI to confirm:

```bash
REPOSITORY=postgres POSTGRES_HOST=localhost npm run cli -- get --id <id-from-curl-response>
```

The CLI also runs completely standalone with no database at all (`REPOSITORY=memory`, the
default) for a quick sanity check:

```bash
npm run cli -- subscribe --customer cust-standalone-1 --plan pro
```

## Why testing is fast here

[`src/core/application/subscribe.use-case.spec.ts`](./src/core/application/subscribe.use-case.spec.ts),
[`change-plan.use-case.spec.ts`](./src/core/application/change-plan.use-case.spec.ts), and
[`cancel.use-case.spec.ts`](./src/core/application/cancel.use-case.spec.ts) test all four
business rules — subscribe, upgrade proration math, downgrade-rejected-mid-cycle, and cancel —
by injecting:

- the **real** `InMemorySubscriptionRepository` adapter (no DB, just a `Map`)
- a trivial fake `PaymentGatewayPort` (`AlwaysSucceedsPaymentGateway` /
  `AlwaysFailsPaymentGateway` in [`test-support/fakes.ts`](./src/core/test-support/fakes.ts))
- a trivial fake `NotifierPort` (`RecordingNotifier`)

all constructed with plain `new` — **zero Postgres, zero NestJS `TestingModule`, zero HTTP
server**. There's no `Test.createTestingModule()` anywhere in these files. Run them:

```bash
npm test
```

[`billing-cycle.spec.ts`](./src/core/domain/billing-cycle.spec.ts) goes one level deeper and
tests the proration formula itself as pure functions, no objects involved at all.

This is the actual payoff of ports & adapters: because the core only depends on interfaces it
defined, a test can hand it any implementation — including one that's just a `Map` and a
counter — and the business rule under test runs in milliseconds with no setup/teardown of any
infrastructure.

## Contrast with Layered Architecture

`11-layered-architecture` in this series organizes code into horizontal layers
(controller → service → repository) where dependencies flow **downward**: the service layer
imports the repository layer, which imports the database driver. That's simple to read top to
bottom, but it means the business logic layer directly depends on infrastructure — testing a
service usually means mocking or spinning up whatever the repository layer talks to, and
swapping the database means touching the service layer's imports.

Hexagonal architecture inverts those arrows. The core never imports an adapter; adapters import
the core's port interfaces. The core is never at the bottom of an import chain pointing at a
database driver — infrastructure always points inward, toward interfaces the core defines for
itself. The trade-off is more indirection (an interface plus at least one implementation for
everything the core touches) in exchange for a core that can be tested and evolved independently
of whatever database or API happens to be plugged in this week.

## Tests

```bash
npm test
```

14 tests across 4 spec files — see [Why testing is fast here](#why-testing-is-fast-here) above.

## Related projects

| Project | What it teaches |
|---|---|
| `01-modular-monolith` | Module boundaries within a single deployable |
| `11-layered-architecture` | The layered alternative this project contrasts with |
| `05-resilience` | Retries/circuit-breakers around an outbound adapter's failures |
