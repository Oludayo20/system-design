# Database Sharding

A runnable reference implementation of database sharding: a NestJS API that
routes user records across three independent PostgreSQL databases (shards)
using a pluggable shard-key strategy. Project 2 of a 4-part system design
series (see the top-level `doc.md`); this one is self-contained and can be
run on its own.

## What is sharding, in plain terms

One database server can only hold so much data and answer so many queries
before it runs out of disk, pegs its CPU, or simply gets slow. You can throw
a bigger box at that for a while (vertical scaling), but eventually you hit
a physical or financial ceiling. Sharding is the answer: instead of one
database holding *all* the data, you split it across multiple database
servers, each holding a *slice*. Instagram, TikTok, Facebook, Amazon, and
Uber all do this at scale.

The core question sharding forces you to answer is: **for any given record,
which server has it?** That's the job of a **shard key** - a rule that maps
a record (usually keyed by something like `userId`) to a specific shard.

## The three shard-key strategies

This repo implements all three as real, unit-tested `ShardingStrategy`
classes (`src/sharding/strategies/`), so you can flip between them with one
environment variable (`SHARDING_STRATEGY`) and see the trade-offs directly.

### 1. Hash (the default here)

`shardIndex = hash(key) % shardCount`

Distributes records evenly regardless of insertion order - no matter how
IDs are assigned, they scatter uniformly across shards. This is the
strategy the demo API uses by default and the one most of the worked
examples below assume.

For numeric keys we use the raw number for the modulo (no hashing needed -
integers already distribute uniformly under `%`); for string keys (e.g. an
email) we fold the string to a stable integer with djb2 first. See
`src/sharding/strategies/hash-sharding.strategy.ts`.

**Trade-off:** trivially even distribution, but resharding (changing
`shardCount`) reshuffles almost every key's shard assignment - there's no
"just add a shard" without a migration.

### 2. Range by ID

`Users 1-3,000,000 -> Shard 0, 3,000,001-6,000,000 -> Shard 1, 6,000,001+ -> Shard 2`

Simple to reason about ("where does user 4.2M live? shard 1") and easy to
extend by appending a new upper bound. But if IDs are assigned
sequentially - the common case - all *new* writes land on whichever shard
owns the current top of the range. That shard runs hot while older shards
sit comparatively idle. See `src/sharding/strategies/range-sharding.strategy.ts`.

### 3. Geography

`Africa -> Shard 0, Europe -> Shard 1, Asia -> Shard 2`

Maps a region field to a shard via a lookup table. Beyond distributing
load, this also cuts latency - a user in Lagos can be served by a shard
that physically sits in a nearby data center instead of one on another
continent. Trade-off: traffic rarely splits evenly across regions, so this
can produce lopsided shards unless the regions are comparable in size (or
get split further later). See `src/sharding/strategies/geo-sharding.strategy.ts`.

**Known limitation, documented honestly:** with geo sharding, `GET
/users/:id` cannot resolve a shard from the id alone - the shard was chosen
by region at write time, not derived from the id. This demo's
`findById` will return a `400` if you flip to `SHARDING_STRATEGY=geo` and
call it, explaining exactly that. In production you'd solve this with a
separate id -> shard directory service (see "Out of scope" below).

## The worked example this repo reproduces exactly

The doc's own example, using `userId % 3`:

| userId | userId % 3 | Shard |
|--------|-----------|-------|
| 15     | 0         | 0     |
| 230    | 2         | 2     |
| 987    | 0         | 0     |
| 1500   | 0         | 0     |

This is a literal unit test - see
`src/sharding/strategies/hash-sharding.strategy.spec.ts` and
`src/sharding/shard-manager.service.spec.ts`. Run `npm test` and watch it pass.

## Lookup: route to exactly one shard, never scatter-gather

The whole point of sharding a query path is that a single-record lookup
touches a single database. Given a `userId`, the app computes the shard
index, opens a connection to *that* shard, and queries it. Nothing else.

```
App receives request for userId=15,345,678
  -> compute shard(15,345,678) = Shard 2
  -> query ONLY Shard 2
  -> return user
```

`ShardManagerService` (`src/sharding/shard-manager.service.ts`) enforces
this structurally: its normal query method, `getPoolForKey(key)`, resolves
and returns exactly one `pg.Pool` - there is no method that hands back "the
pool for shard N" for arbitrary use, so calling code can't accidentally
fan out. The only method that exposes every pool is `getAllPools()`, and it
is used in exactly one place: the debug/distribution endpoint below.

This is also *why* sharding is fast at scale: each shard holds a fraction
of the rows, so its indexes are smaller, its working set fits in memory
more easily, and a query does less CPU and disk I/O than the same query
would against one giant table holding everything.

## Sharding vs. replication

These get confused constantly. They solve different problems and are
usually both present in a mature system:

| | Replication | Sharding |
|---|---|---|
| **Data on each node** | Same data everywhere (primary -> replica1/2/3) | Different data per node (shard1 = users 1-1M, shard2 = 1M-2M, ...) |
| **Purpose** | More read capacity, availability, backups | Store more data, distribute writes, reduce load per DB |
| **What fails if a node dies** | Reads can go to another replica; data isn't lost | That shard's data is unavailable until it's restored |
| **Scales which axis** | Read throughput | Total data volume and write throughput |

Replication copies the same data everywhere so more machines can answer the
same reads. Sharding splits *different* data across machines so no single
machine has to hold or serve all of it. A large system typically shards
*and* replicates each shard.

## "One database" is really "one logical database"

To the application, and often to the developers building on top of it, it
looks like there's a single `Database`. In reality, behind a routing layer,
it's `Shard0 / Shard1 / Shard2`, and the app (or a router service) decides
which one to hit for any given operation. This repo makes that routing
layer explicit rather than hiding it: `ShardManagerService` *is* the "one
logical database" - every other module talks to it, never to a shard's
connection pool directly.

## Worked example: Oja at 100M users

Imagine Oja (the marketplace this doc's author builds, and the basis for
this series' capstone) grows to 100 million users. Instead of one Postgres
instance holding Users, Products, Orders, Chats, and Wallets for all of
them, you shard by `userId`:

```
Shard 0 = users 1        - 10,000,000
Shard 1 = users 10,000,001 - 20,000,000
Shard 2 = users 20,000,001 - 30,000,000
...
```

When user `15,345,678` logs in:

```
App -> calculate shard(15,345,678) -> Shard 1
     -> query ONLY Shard 1
     -> return user
```

Only one database is ever touched for that login. This repo's `range`
strategy defaults to exactly this 10M-per-shard boundary scheme (see
`src/sharding/sharding-strategy.factory.ts`), scaled to however many shards
you configure.

## When to actually shard

Sharding is usually the *last* rung on a scaling ladder, not the first:

1. One PostgreSQL database
2. Add a Redis cache
3. Add read replicas
4. Partition large tables if needed
5. Shard the database

**Most SaaS applications never reach stage 5.** You can serve millions of
users with a well-designed single PostgreSQL database, proper indexing,
caching, read replicas, and optimized queries. Sharding adds significant
complexity - more moving parts to operate, cross-shard queries and joins
become hard or impossible, transactions no longer span your whole dataset,
and resharding later is a real migration, not a config change. Reach for
it only once you've genuinely outgrown stages 1-4, not because it sounds
impressive.

## Out of scope (called out, not faked)

- **Resharding / a shard-map lookup service.** A production system that
  expects to add shards over time typically maintains a directory
  (userId/range -> shard) that can be updated independently of the hashing
  formula, so keys can be migrated between shards without recomputing every
  key's home from scratch. This demo hard-codes shard count and strategy
  via config; it does not implement live resharding or a migration tool.
- **A distributed ID-generation cluster.** `IdGeneratorService`
  (`src/common/id-generator.service.ts`) is a simplified, single-process
  Snowflake-style generator (seconds timestamp + worker id + sequence, sized
  to stay within a JS-safe integer). It's enough to guarantee unique,
  roughly time-ordered IDs across shards for this demo. A real deployment
  would run a dedicated ID service or a battle-tested library.
- **Cross-shard joins/transactions.** Not needed for this demo's single
  `users` table, but worth naming: sharding makes multi-shard joins and
  transactions expensive or impossible in the general case, which is part
  of why it's a last resort.

## Project layout

```
src/
  config/               env-driven configuration (shard connection info, strategy, count)
  sharding/
    sharding-strategy.interface.ts    the ShardingStrategy contract
    strategies/                       Hash / Range / Geo implementations + unit tests
    sharding-strategy.factory.ts      builds the active strategy from config
    shard-manager.service.ts          owns one pg.Pool per shard, routes by key
    sharding.module.ts
  users/
    dto/                              CreateUserDto, UserResponseDto, ShardDistributionResponseDto
    users.controller.ts               POST /users, GET /users/:id, GET /users/_debug/distribution
    users.service.ts
    users.repository.ts               plain SQL against whichever pool it's handed
  common/
    id-generator.service.ts           global ID generator (id first, then hash to shard)
  db/init/001-create-users-table.sql  schema applied to every shard container
scripts/
  seed.ts                             inserts ~1000 synthetic users, prints distribution
```

## Running it

> **Hosting & deployment:** See [HOSTING.md](./HOSTING.md) for Docker setup, platforms (free → paid), production tooling, and per-component checklists.

Requires Docker (for the three Postgres shards) and Node 20+.

```bash
# 1. copy env defaults (already matches docker-compose.yml)
cp .env.example .env

# 2. start three independent Postgres containers, one per shard
docker compose up -d

# 3. install deps
npm install

# 4. run the API in watch mode
npm run start:dev
# -> Sharding demo listening on port 3000 (Swagger at /docs)

# 5. seed ~1000 synthetic users and print the per-shard distribution
npm run seed
```

### Example calls

```bash
# create a user - id is generated first, then hashed to a shard
curl -s -X POST localhost:3000/users \
  -H 'Content-Type: application/json' \
  -d '{"email":"ada@oja.africa","displayName":"Ada Lovelace","region":"africa"}' | jq

# fetch it back - resolves the shard from the id, queries ONLY that shard
curl -s localhost:3000/users/<id-from-above> | jq

# 404 for an id that doesn't exist on its resolved shard
curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/users/999999999999

# the one legitimate fan-out endpoint: COUNT(*) on every shard
curl -s localhost:3000/users/_debug/distribution | jq
```

`GET /users/_debug/distribution` is explicitly a debug/ops endpoint - it's
the only code path in this repo allowed to call `getAllPools()` and hit
every shard. It exists so you can *see* that the hash strategy balances
load; it is never something the hot path does for a single-record lookup.

### Seeing the strategies differ

The seed script reads `SHARDING_STRATEGY` from your `.env` just like the
API does:

- `SHARDING_STRATEGY=hash` (default) - run `npm run seed`, then hit
  `/users/_debug/distribution`. Expect roughly ~333 users per shard out of
  1000.
- `SHARDING_STRATEGY=range` - same seed script, same 1000 users. Because
  their IDs are generated sequentially in time by `IdGeneratorService`, they
  all fall within one narrow id window and pile onto a single shard's range
  bucket instead of spreading out. That skew is the concrete version of the
  "hot shard" problem range sharding warns about above.
- `SHARDING_STRATEGY=geo` - distribution follows whatever mix of
  `africa`/`europe`/`asia` the random seed data happens to produce (roughly
  even here, since the seed script picks regions uniformly at random - real
  traffic wouldn't be this convenient).

No extra code is needed to see this: the strategy classes already support
range and geo, `.env` just has to say which one is active.

## Verifying without Docker

If you don't have Docker running, you can still validate the parts of this
repo that don't require a live database:

```bash
npm install
npm run build   # compiles cleanly
npm test        # runs the pure-logic strategy + ShardManager routing tests,
                 # including the exact userId % 3 worked example - no DB needed
```

The Users API, seed script, and `/users/_debug/distribution` endpoint all
need the three Postgres containers from `docker compose up -d` to actually
exercise a database.
