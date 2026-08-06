# Redis: How It Works and Why

Redis provides **fast, ephemeral storage** for data that either changes often, can be rebuilt from Postgres, or does not need durable history. This app uses it for **sessions** and **product cache-aside**.

---

## Why Redis exists in this stack

| If you only had Postgres | Problem |
|--------------------------|---------|
| Session lookup every request | Extra DB load for data that expires anyway |
| Product read on every basket line | Repeated identical reads for hot products |

Redis sits in front of Postgres for these paths. If Redis is down, the app can still function (sessions unused by guard today; catalog falls through to Postgres on cache miss).

---

## How the module is structured

```
RedisModule (@Global)
  ├── REDIS_CLIENT token → ioredis instance from REDIS_URL
  └── RedisService → wrapper with get/set/setJson/del/incr
```

**Why a wrapper instead of injecting ioredis everywhere?**

1. **Swap implementation** — test with mock, change client library in one file.
2. **Consistent JSON handling** — `getJson` parses safely; corrupt cache → treat as miss, log warning.
3. **Lifecycle** — `onModuleDestroy` calls `quit()` cleanly.

**Why `REDIS_CLIENT` in a separate constants file?** Avoids circular imports between `redis.module.ts` and `redis.service.ts` (same pattern as RabbitMQ token).

**Why `lazyConnect: false`?** Fail fast at startup if Redis is unreachable, rather than failing on first request.

---

## Use case 1: Identity sessions

On register/login, `IdentityService.issueSession()` writes:

```
Key:   session:{userId}
Value: { "email": "jane@example.com" }
TTL:   7 days
```

**How it's used today:** Written but not read by `JwtAuthGuard` — guard validates JWT only.

**Why write it anyway?** Demonstrates where **server-side session state** lives for:
- Logout / "revoke all sessions" (delete key)
- Future guard: reject JWT if `session:{userId}` missing
- Admin "force logout user" without waiting for JWT expiry

**Why Redis not Postgres for sessions?** High read/write ratio, TTL eviction built-in, no migration overhead for session shape changes.

---

## Use case 2: Catalog product cache-aside

**Read path** (`getProduct`):

```
GET catalog:product:{id}
  → hit: return JSON
  → miss: SELECT postgres → SETEX 300 → return
```

**Invalidation path** (`decrementStock`):

```
UPDATE postgres stock
DEL catalog:product:{id}
```

**Why delete on stock change not update cache?** Delete is simpler and always correct. Update-in-cache risks partial updates (price changed elsewhere). Next read repopulates full product object.

**Why not cache basket in Redis?** This demo persists cart in Postgres for durability across Redis restarts. Guest carts or session carts would be a natural Redis use case — different product requirement.

---

## Key naming convention

```
session:{userId}
catalog:product:{productId}
```

**Why prefixed keys?** Single Redis instance shared by modules. Prefixes prevent collisions and make `KEYS catalog:*` debugging safe in dev.

---

## Configuration

`REDIS_URL=redis://localhost:6379` (host)  
`REDIS_URL=redis://redis:6379` (Docker Compose service name)

---

## What Redis is NOT used for (yet)

| Potential use | Why not in demo |
|---------------|-----------------|
| Rate limiting login | Extension; `incr` + `expire` ready on `RedisService` |
| OTP codes | Same pattern |
| Pub/Sub for events | RabbitMQ chosen for durable queues and routing |

Event durability belongs in RabbitMQ (messages persisted to disk). Redis pub/sub is fire-and-forget — wrong tool for `order.created`.
