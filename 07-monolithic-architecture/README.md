# BlogStack — Monolithic Architecture

Project 7 of the system design series. This one demonstrates the **plain monolith** doc.md
describes before it gets to modules with enforced boundaries: one codebase, one process, one
deployment, one shared database — and modules that call each other's services directly because
nothing stops them.

## Concept, in my own words

A monolith is just an application shipped as a single deployable unit:

- **One codebase** — every module (`auth`, `users`, `posts`, `comments`, `notifications`) lives
  in the same `src/` tree, in the same repository.
- **One process** — one Node.js process, one `main.ts` entrypoint, one running container.
- **One deployment** — `docker build . && docker run ...` ships all five modules at once. You
  cannot deploy a fix to `comments` without redeploying `auth` too.
- **One shared database** — every module's tables live in the same PostgreSQL database, in the
  same `public` schema, with real foreign keys crossing module lines.
- **Direct, in-process calls** — when one module needs another module's logic, it injects that
  module's service and calls a method on it. No event bus, no message queue, no HTTP hop, no
  interface contract. It's just a function call, so it's fast and simple to write — and it also
  means a bug or an outage in one module's code path can take down a request that otherwise had
  nothing to do with it.

This is deliberately the **naive** monolith doc.md draws first ("everything calling everything")
before introducing the modular monolith with strict boundaries and domain events.

## Doc.md concept → where it's implemented

| doc.md concept | Where it lives in this repo |
|---|---|
| One repository, one deployment, `docker build . && docker run` | Single `src/` tree, single `Dockerfile`, single `docker-compose.yml` `api` service |
| Modules as independent business areas (Catalog, Basket, Ordering, Identity in the doc) | `src/modules/{auth,users,posts,comments,notifications}` — BlogStack's equivalents |
| "Everything calling everything" (the doc's *bad* monolith) | `CommentsService` injects `PostsService`, `UsersService`, and `NotificationsService` and calls their methods directly — see `src/modules/comments/comments.service.ts` |
| Modules importing modules | `src/modules/comments/comments.module.ts` imports `PostsModule`, `UsersModule`, and `NotificationsModule` in one `imports` array |
| Every module stores its data in PostgreSQL, "single shared database" variant | One Postgres instance, one database, no schema-per-module split — see `src/infrastructure/postgres/migrations/1712000000000-InitialSchema.ts` |
| API as the entry point that routes to a module | `src/main.ts` + one Nest `AppModule` wiring all five feature modules |
| JWT auth / Identity module | `src/modules/auth` (register, login, `@nestjs/jwt`, bcrypt) |
| "If Notifications breaks, the request that triggered it breaks too" | `CommentsService.create()` calls `NotificationsService.notifyNewComment()` synchronously, in the same request, after saving the comment — see `src/modules/comments/comments.service.ts` |

## Unlike 01-modular-monolith

`01-modular-monolith` forbids modules from reaching into each other and communicates via domain
events (RabbitMQ) — Basket never imports Ordering's repository, Ordering never imports Basket's
service methods for anything but a narrow, exported contract. This project shows the classic
monolith the doc describes first: modules import each other's services directly. `CommentsModule`
imports `PostsModule`, `UsersModule`, and `NotificationsModule`, and `CommentsService` calls
`PostsService.findById()`, `UsersService.findById()`, and `NotificationsService.notifyNewComment()`
as plain method calls — not HTTP requests, not published events. That's the tradeoff this project
exists to make concrete: it's simpler to write, and it's also how one module's bug becomes every
module's outage.

## Run it

> **Hosting & deployment:** See [HOSTING.md](./HOSTING.md) for Docker setup, platforms (free →
> paid), and per-component checklists.

```bash
cp .env.example .env
docker compose up --build
```

Swagger: `http://localhost:3007/docs`

### Try it

```bash
BASE=http://localhost:3007

# 1. Register
curl -s -X POST $BASE/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"jane@example.com","password":"S3curePassword!","displayName":"Jane Doe"}' | tee /tmp/register.json

TOKEN=$(node -e "console.log(require('/tmp/register.json').accessToken)")

# 2. Login (same credentials, issues a fresh token)
curl -s -X POST $BASE/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"jane@example.com","password":"S3curePassword!"}'

# 3. Create a post
curl -s -X POST $BASE/posts \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"Why plain monoliths still ship products","body":"One repo, one deploy, direct calls."}' | tee /tmp/post.json

POST_ID=$(node -e "console.log(require('/tmp/post.json').id)")

# 4. Register a second user and comment on the first user's post
curl -s -X POST $BASE/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"amir@example.com","password":"S3curePassword!","displayName":"Amir Musa"}' | tee /tmp/register2.json

TOKEN2=$(node -e "console.log(require('/tmp/register2.json').accessToken)")

curl -s -X POST $BASE/posts/$POST_ID/comments \
  -H "Authorization: Bearer $TOKEN2" -H 'Content-Type: application/json' \
  -d '{"body":"Great breakdown of the tradeoffs!"}'

# 5. List comments on the post (public, no auth)
curl -s $BASE/posts/$POST_ID/comments

# 6. Confirm the comment triggered a notification: log in as Jane (the post owner) and
#    check her notifications — CommentsService called NotificationsService directly in step 4.
curl -s $BASE/notifications/me -H "Authorization: Bearer $TOKEN"
```

Step 6 should return a notification row like:

```json
[{ "message": "Amir Musa commented on your post \"Why plain monoliths still ship products\"", "read": false, ... }]
```

That row exists because `CommentsService.create()` called `NotificationsService.notifyNewComment()`
directly, in the same request that saved the comment — not because a worker picked up an event
sometime later.

## The downside, made concrete

**A typo redeploys everything.** Say someone fixes a copy-editing typo in the comment validation
message in `src/modules/comments/dto/create-comment.dto.ts`. There's no way to ship just that
change: `docker build . && docker run` rebuilds and redeploys the *entire* BlogStack image —
`auth`, `users`, `posts`, and `notifications` all restart too, even though none of their code
changed. Every deploy is an all-or-nothing deploy of five modules, forever, no matter how small
the change.

**You can't scale the hot module alone.** Suppose `POST /posts/:id/comments` gets hammered
because a popular post is trending, while `auth` and `posts` traffic stays flat. In this project
there is exactly one deployable unit — the `api` service in `docker-compose.yml` — so the only
lever you have is running more copies of the *whole application*. Every replica you add to handle
comment load also duplicates idle `auth`, `users`, and `notifications` capacity you didn't need.
Compare that to extracting `comments` into its own service (or even just its own scaling group):
you'd size it for its own traffic instead of over-provisioning the rest of BlogStack to keep up.

**One module's outage is every module's outage.** Because `CommentsService.create()` calls
`NotificationsService.notifyNewComment()` synchronously in the same request, an unhandled error
or a slow/locked `notifications` table doesn't just fail notifications — it fails the comment
the user was trying to post, even though the comment itself saved successfully. There is no
retry queue, no dead-letter table, no "notifications are degraded but the rest of the app is
fine." The failure domain of the whole monolith is the failure domain of its slowest, buggiest
module on any given request.

## Tests

```bash
npm test
```

## Related projects

| Project | What it adds on top of this one |
|---|---|
| `01-modular-monolith` | Same "one deploy, one process" shape, but enforces module boundaries with a domain event bus instead of direct service calls |
| `05-resilience` | Retries, circuit breakers, and fallbacks — the pattern you'd reach for if `comments -> notifications` had to survive `notifications` being down |

Full concept write-up: [`doc.md`](../doc.md)
