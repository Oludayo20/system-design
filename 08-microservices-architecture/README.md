# Microservices Architecture — BookHive

Project 8 of the system design series. Projects 01 and 04 built **modular monoliths** — one
repository, one deployment, modules talking to each other in-process. This project is the
opposite: a small online bookstore, **BookHive**, split into four independently deployable
services, each with its own database, that only ever talk to each other over the network.

## Concept, in my own words

A microservice is a service that:

- Does **one thing** (auth, catalog, orders, notifications — not "the backend")
- Owns **its own data** — no other service can query its database, because no other service
  has its connection string
- Is **built, deployed, and scaled independently** of every other service
- Talks to other services **over the network** (HTTP here; could be gRPC, or a message queue for
  async cases) instead of importing their code and calling a function

That last point is the whole architectural shift. In a modular monolith, `OrdersModule` calls
`CatalogModule.checkStock()` — a function call, same process, same transaction if you want one.
In microservices, `order-service` calls `catalog-service` — a network request, a different
process, a different failure mode. You trade in-process simplicity for independent
deployability, and you take on everything that comes with a network in the middle:

| You get | You pay for |
|---|---|
| Deploy `notification-service` without touching anything else | Every call can now time out, drop, or arrive twice |
| Scale `catalog-service` to 3 replicas without scaling `auth-service` | Retries, timeouts, and fallbacks are now *your* problem per call, not a language feature |
| A bug in one service can't corrupt another service's schema | Debugging one user request means reading logs across 4 processes, not one stack trace |
| Small, focused codebases per team | More moving parts: 4 apps, 3 databases, 1 gateway, all versioned separately |
| A service that's down doesn't have to take the whole system down (see "Fault isolation" below) | You have to *design* for that — it isn't free, see `order-service`'s notification call |

### The bad/good example this whole project demonstrates

> **Bad:** Orders Service directly queries the Payment/Catalog database.
> **Good:** Orders Service calls Catalog Service over HTTP.

`order-service` needs a book's price and current stock to place an order. It does **not** have a
`CATALOG_DB_*` environment variable anywhere — check `docker-compose.yml` or
`order-service`'s own `src/config/configuration.ts` — so direct-database-access isn't a
discipline problem being avoided by convention, it's structurally impossible: the credentials
simply are not in that container. Instead it calls `POST /books/:id/reserve` on
`catalog-service` over HTTP (`order-service/src/catalog/catalog-client.service.ts`).

```bash
# Proof: order-service has no catalog-db (or auth-db) connection info at all.
docker compose exec order-service env | grep -i db
# ORDER_DB_HOST=order-db
# ORDER_DB_PORT=5432
# ORDER_DB_USER=bookhive
# ORDER_DB_PASSWORD=bookhive_dev_password
# ORDER_DB_NAME=order_db
# (nothing about catalog-db or auth-db - it literally cannot connect to either)
```

## Architecture

```text
                                   clients (curl / Postman / browser)
                                                  │
                                                  ▼
                                   ┌─────────────────────────────┐
                                   │   gateway  (Express, :3008)  │
                                   │  routing + rate limit + log  │
                                   │   auth header pass-through   │
                                   └───────────────┬───────────────┘
                     ┌───────────────┬─────────────┼─────────────┬───────────────┐
                     │ /auth*        │ /books*     │ /orders*    │ /notifications*
                     ▼               ▼             ▼             ▼
           ┌──────────────┐ ┌────────────────┐ ┌──────────────┐ ┌───────────────────┐
           │ auth-service │ │ catalog-service │ │ order-service│ │ notification-svc   │
           │  (Nest,4001) │ │  (Nest, 4002)   │ │ (Nest, 4003) │ │ (Express, 4004)    │
           └──────┬───────┘ └────────┬────────┘ └──────┬───────┘ └─────────┬──────────┘
                  │                  │        HTTP:     │  HTTP (fire-and-forget,
                  │                  │◄──reserve stock───┤   timeout + swallow) ───►│
                  ▼                  ▼                  ▼                  (in-memory,
           ┌──────────────┐ ┌────────────────┐ ┌──────────────┐             no DB)
           │   auth-db    │ │   catalog-db    │ │   order-db   │
           │  (Postgres)  │ │   (Postgres)    │ │  (Postgres)  │
           └──────────────┘ └────────────────┘ └──────────────┘

   Each Postgres container is reachable ONLY by the one service that owns it.
   No service holds another service's DB credentials - see docker-compose.yml.
```

Identity flows without a network call: every Nest service (auth, catalog, order) independently
verifies JWTs against the same `JWT_SECRET` — `order-service` never calls `auth-service` to check
who's calling it, it just decodes the bearer token gateway forwarded. This is the same trick
`04-ecom-marketplace-capstone` uses to let `api-1`/`api-2` validate tokens with no shared session
store — applied here across process boundaries instead of just across replicas.

## Endpoints

All routes below work identically through the gateway (`http://localhost:3008`) or hit directly
(`http://localhost:<service-port>`) — the gateway is the intended path, direct ports exist for
debugging.

### Gateway — `:3008`

| Method | Path | Forwards to |
|---|---|---|
| GET | `/health` | (gateway itself) |
| * | `/auth/*` | auth-service |
| * | `/books*` | catalog-service |
| * | `/orders*` | order-service |
| * | `/notifications*` | notification-service |

### Auth Service — `:4001` (Swagger at `/docs`) — owns `auth-db`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | — | Create a user, receive a JWT |
| POST | `/auth/login` | — | Receive a JWT |
| GET | `/auth/verify` | Bearer | Verify a token by hand |

### Catalog Service — `:4002` (Swagger at `/docs`) — owns `catalog-db`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/books` | Bearer | Add a book |
| GET | `/books` | — | List books |
| GET | `/books/:id` | — | Get one book |
| POST | `/books/:id/reserve` | Bearer | Atomically decrement stock (called by order-service) |

### Order Service — `:4003` (Swagger at `/docs`) — owns `order-db`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/orders` | Bearer | Place an order — calls catalog-service, then notification-service |
| GET | `/orders` | Bearer | List your orders |
| GET | `/orders/:id` | Bearer | Get one of your orders |

### Notification Service — `:4004` — no database

| Method | Path | Description |
|---|---|---|
| POST | `/notifications` | Record a notification (called by order-service) |
| GET | `/notifications` | Inspect everything "sent" so far |
| GET | `/health` | Liveness probe |

## Run it

> **Hosting & deployment:** See [HOSTING.md](./HOSTING.md) for prerequisites, per-component
> notes, and production tooling.

This spins up 8 containers (4 apps + 1 gateway + 3 Postgres) — like `04-ecom-marketplace-capstone`,
give Docker a few GB of RAM.

```bash
cp .env.example .env
docker compose up --build
```

Wait for all services to report healthy (`docker compose ps`), then hit the gateway at
`http://localhost:3008`.

### Try it

```bash
BASE=http://localhost:3008

# 1. Register
curl -s -X POST $BASE/auth/register -H 'Content-Type: application/json' \
  -d '{"email":"reader@bookhive.dev","password":"hunter22","fullName":"Ada Lovelace"}' | tee /tmp/register.json

TOKEN=$(node -e "console.log(require('/tmp/register.json').accessToken)")

# 2. (Or login instead, once registered)
curl -s -X POST $BASE/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"reader@bookhive.dev","password":"hunter22"}'

# 3. Create a book via catalog-service
curl -s -X POST $BASE/books -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"The Pragmatic Programmer","author":"Hunt & Thomas","priceCents":3500,"stock":10}' \
  | tee /tmp/book.json

BOOK_ID=$(node -e "console.log(require('/tmp/book.json').id)")

# 4. Place an order - order-service calls catalog-service over HTTP to reserve stock
curl -s -X POST $BASE/orders -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"bookId\":\"$BOOK_ID\",\"quantity\":2}"

# 5. Confirm notification-service saw it (order-service called it fire-and-forget)
curl -s $BASE/notifications

# 6. Fault isolation: stop notification-service, place another order, prove it still succeeds
docker compose stop notification-service
curl -s -X POST $BASE/orders -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"bookId\":\"$BOOK_ID\",\"quantity\":1}"
# -> still 201 Created. Check order-service logs: it logged the notification failure
#    and moved on instead of failing the order.
docker compose start notification-service
```

### Independent scaling

```bash
docker compose up --build --scale catalog-service=3
```

**Caveat that is actually true of this compose file:** `catalog-service` has a fixed host port
mapping (`4002:4002` in `docker-compose.yml`). Scaling it to 3 replicas will start all 3
containers, but only the first one can bind host port 4002 — the second and third will fail to
start with a port-already-allocated error, unless you first remove or templatize that port
mapping (e.g. `ports: ["4002"]` for a random host port per replica, or drop the `ports:` block
entirely and only reach catalog-service through the gateway). The replicas *would* all be
reachable from `gateway` and `order-service` on the internal Docker network regardless — that
network path doesn't go through the host port at all — it's only direct host access to the extra
replicas that the fixed mapping blocks.

### Independent deployment

Found a bug in `notification-service`? Rebuild and redeploy only it:

```bash
docker compose up --build -d notification-service
```

Nothing else restarts — `gateway`, `auth-service`, `catalog-service`, `order-service`, and all
three databases keep running untouched. Compare that to a monolith, where shipping any change
means rebuilding and redeploying the whole application.

### Fault isolation

```bash
docker compose stop notification-service
# ... place an order (see "Try it" step 6 above) ...
# It still returns 201. order-service's fire-and-forget call to notification-service
# has a NOTIFICATION_TIMEOUT_MS budget (default 2000ms) and swallows any failure -
# see order-service/src/notification/notification-client.service.ts.
docker compose start notification-service
```

This is implemented for real, not just asserted: `NotificationClientService.notifyOrderCreated`
wraps its `fetch` call in a try/catch fed by an `AbortController` timeout, logs a warning on any
failure (timeout, connection refused, non-2xx), and returns normally either way.
`OrdersService.placeOrder` awaits it purely to log the outcome — its own success was already
decided by the catalog reservation and the order-db write that happened before it.

## Tests

```bash
cd auth-service && npm test      # or catalog-service / order-service
```

`gateway` and `notification-service` don't have unit tests — the "Try it" curl walkthrough above
*is* their test; they're thin enough that testing them would mostly test Express and
http-proxy-middleware.

## Related projects

| Project | What it adds on top of this one |
|---|---|
| `01-modular-monolith` / `04-ecom-marketplace-capstone` | The opposite structure — same features, one deployable |
| `03-async-queue-processing` | How the notification call here would become durable (RabbitMQ + retry + DLQ) instead of best-effort |
| `05-resilience` | Retries, circuit breakers, and fallbacks — the pattern `order-service`'s catalog call is missing on purpose, to keep this project focused on ONE lesson |
