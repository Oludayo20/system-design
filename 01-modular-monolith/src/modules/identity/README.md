# Identity Module: How It Works and Why

Identity handles **who the user is** — registration, login, password storage, JWT tokens, and session records. Every protected route in Basket and Ordering depends on this module.

---

## How registration works

1. Client sends `{ email, password, fullName }` to `POST /auth/register`.
2. `IdentityService` checks if email already exists → `409 Conflict` if duplicate.
3. Password is hashed with **bcrypt** (10 salt rounds) — the plain password is never stored.
4. A row is inserted into `identity.users` with role `customer`.
5. `issueSession()` runs (same path as login).

**Why bcrypt?** Password hashing must be slow enough to resist brute force. bcrypt is the standard choice; salt rounds are configurable via the cost factor.

**Why check duplicate email before insert?** The DB has a unique index on email as a safety net, but the service returns a clear `409` message instead of exposing a raw database constraint error.

---

## How login works

1. Client sends `{ email, password }` to `POST /auth/login`.
2. Load user by email. If missing → `401 Invalid credentials`.
3. `bcrypt.compare()` against stored hash. If mismatch → same generic `401`.

**Why the same error message for wrong email vs wrong password?** Prevents **email enumeration** — an attacker cannot distinguish "this email exists" from "wrong password" by reading the error text.

---

## How a session is issued (register and login)

`issueSession(user)` does two things:

1. **Sign a JWT** with payload `{ sub: userId, email, roles }`, using `JWT_SECRET` and `JWT_EXPIRES_IN` (default 1 hour).
2. **Write Redis** key `session:{userId}` with `{ email }`, TTL 7 days.

Returns `{ accessToken, user: { id, email, fullName, roles } }`.

**Why JWT for the client?** Stateless on the wire — the API can validate the token without a DB round-trip on every request. The client sends `Authorization: Bearer <token>` on protected routes.

**Why also write Redis?** JWTs cannot be revoked until they expire. The Redis session is a **revocation hook**: in production you could delete `session:{userId}` on logout and have the guard check Redis before accepting the token. This demo writes the session but the guard validates JWT only — the Redis write shows where session management would extend.

**Why 7-day Redis TTL vs 1-hour JWT expiry?** They serve different purposes. JWT expiry limits how long a stolen token works without refresh. Session TTL bounds how long server-side session metadata is kept. A full implementation would add refresh tokens; this demo keeps the surface small.

---

## How protected routes work

Basket and Ordering controllers use `@UseGuards(JwtAuthGuard)`:

1. `JwtAuthGuard` invokes Passport's JWT strategy.
2. `JwtStrategy` extracts the Bearer token, verifies signature and expiry.
3. On success, the payload is attached to `request.user`.
4. `@CurrentUser()` decorator reads `{ userId, email, roles }` in the controller.

**Why Passport?** NestJS integrates cleanly with Passport strategies. The guard runs **before** the controller — unauthenticated requests never reach business logic.

**Why is the guard exported from IdentityModule?** Other modules need the same auth mechanism without duplicating JWT config. Identity owns auth; others import the guard.

---

## Data model

Table: `identity.users` (schema `identity`)

- `password_hash` — never exposed in API responses
- `roles` — stored as a simple array; default `customer`, `admin` reserved for future admin routes

**Why a separate `identity` schema?** Same database as other modules, but no cross-schema foreign keys. Basket stores `user_id` as a UUID without FK to `identity.users` — same boundary pattern as `product_id` in the cart.

---

## What Identity deliberately does not do

- Password reset / email verification (would need Notifications + token table)
- OAuth / social login (different flow, same module would own it)
- Per-route authorization policies beyond "is logged in" (would add `@Roles()` guard using `roles` from JWT)

---

## Key files

| File | What it does |
|------|--------------|
| `identity.service.ts` | Register, login, bcrypt, `issueSession` |
| `strategies/jwt.strategy.ts` | Validates Bearer token, builds `request.user` |
| `guards/jwt-auth.guard.ts` | Rejects requests without valid JWT |
| `entities/user.entity.ts` | `identity.users` mapping |
