# Riverside Library — N-Tier / Layered Architecture

Project 11 of the system design series. This one demonstrates **Layered Architecture (N-Tier)**:
organizing code *inside a single application* into layers with a strict, one-directional
dependency flow, rather than splitting the application into separate deployable services.

## Concept, in my own words

A layered architecture slices one codebase into horizontal bands, and each band is only allowed
to call the band directly below it:

```
Presentation -> Application -> Domain -> Data Access -> Database
```

- **Presentation** — controllers and DTOs. It knows about HTTP (routes, status codes, request
  bodies) and nothing else. It never touches a repository or a database row directly; it only
  calls into the Application layer.
- **Application** — use-case orchestrators (one class per user action: "borrow a book", "return a
  book"). This layer coordinates *steps* — fetch this, ask that, save this — but it contains no
  business rules of its own. It asks the Domain layer for decisions and executes what it's told.
- **Domain** — plain classes and functions with the actual business rules. This is the only layer
  that matters for correctness, and it's deliberately framework-agnostic: no NestJS decorators,
  no TypeORM, no HTTP status codes. It doesn't know it's running inside a web server.
- **Data Access** — repositories. The only layer allowed to import an ORM or talk to a real
  database. It implements repository *interfaces* that the Domain/Application layers depend on,
  so the rest of the app never has to know whether rows live in Postgres, SQLite, or memory.
- **Database** — PostgreSQL. Just storage.

The classic teaching analogy is a restaurant: the **customer** is the Presentation layer — they
just place an order and expect a plate of food back. The **waiter** is the Application layer —
they carry the order to the kitchen and carry the plate back, but they don't decide what "medium
rare" means or whether the kitchen is out of salmon. The **chef** is the Domain layer — the chef
owns every actual cooking decision (recipes, substitutions, what "done" means) and doesn't care
whether the order came from a phone app or a waiter's notepad. **Kitchen staff running to the
pantry** are the Data Access layer — they're the only ones who touch the shelves. The **pantry
itself** is the Database. A customer who tried to walk into the kitchen and grab ingredients
directly would break the whole model — and that's exactly the shortcut this architecture forbids
by wiring the layers so it isn't even possible in code.

## This is not microservices

It's easy to hear "layers" and picture separate services talking over the network. It's the
opposite of that. Riverside Library is **one NestJS process, one `npm run build`, one Docker
image, one deployment** — there is no HTTP call, message queue, or network hop between
Presentation and Domain; it's just one TypeScript function calling another inside the same
process. The boundaries here are *compile-time* discipline (folder structure, interfaces, import
rules) enforced by convention and code review, not runtime boundaries enforced by a network. You
get separation of concerns without any of the operational cost of distributed systems (service
discovery, network failures, distributed transactions). Microservices split a system by
*business capability* across processes; layered architecture organizes *one* business capability's
codebase internally. They solve different problems and can even be combined (each microservice
can itself be internally layered).

## Domain model

- **Book** — `title`, `author`, `isbn`, `totalCopies`, `availableCopies`
- **Member** — `name`, `email`, `membershipStatus`
- **Loan** — `bookId`, `memberId`, `borrowedAt`, `dueAt`, `returnedAt`

## The 4 business rules (all live in `loans/domain/`)

1. A member cannot borrow a book if `availableCopies === 0`.
2. A member cannot have more than 3 active (unreturned) loans at once.
3. A member with any overdue loan (past `dueAt`, unreturned) cannot borrow further books until
   they return it.
4. Returning a book increments `availableCopies` and sets `returnedAt`.

All four are implemented as plain TypeScript in
[`src/loans/domain/loan-eligibility.rules.ts`](./src/loans/domain/loan-eligibility.rules.ts)
(rules 1–3) and [`src/loans/domain/loan.entity.ts`](./src/loans/domain/loan.entity.ts) /
[`src/books/domain/book.entity.ts`](./src/books/domain/book.entity.ts) (rule 4). None of those
three files import `@nestjs/*` or `typeorm` — you can check yourself:

```bash
grep -rn "^import" src/*/domain/ | grep -Ei "typeorm|@nestjs"
# (no output)
```

## One module's folder structure — `loans/`

```text
src/loans/
  presentation/
    loans.controller.ts          # HTTP only: routes, params, calls into application/
    dto/
      borrow-book.dto.ts         # request shape + class-validator rules
      loan-response.dto.ts       # response shape for Swagger
  application/
    borrow-book.use-case.ts      # orchestrates: fetch book+member, ask domain, save
    return-book.use-case.ts      # orchestrates: fetch loan, ask domain, free up stock
    list-member-loans.use-case.ts
  domain/
    loan.entity.ts                # pure class: isOverdue(), markReturned()
    loan-eligibility.rules.ts     # pure class: the 3 borrowing rules
    loan-domain.errors.ts         # plain Error subclasses (no HttpException)
    loan-repository.port.ts       # interface + DI token — no ORM types
    loan-eligibility.rules.spec.ts  # tests with zero DB, zero NestJS
    loan.entity.spec.ts
  infrastructure/
    loan.orm-entity.ts            # @Entity() — the only loan-shaped class TypeORM knows about
    typeorm-loan.repository.ts    # implements loan-repository.port.ts against Postgres
    loans.module.ts               # wires it all together via DI tokens
```

`books/` and `members/` mirror the same four sub-layers.

## Walkthrough: `POST /loans` through all 4 layers

1. **Presentation** — [`loans/presentation/loans.controller.ts`](./src/loans/presentation/loans.controller.ts)'s
   `borrow()` method receives the HTTP request, and NestJS's `ValidationPipe` (configured in
   [`main.ts`](./src/main.ts)) has already validated the body against
   [`BorrowBookDto`](./src/loans/presentation/dto/borrow-book.dto.ts) (`bookId`, `memberId` must
   be UUIDs). The controller does nothing else — it calls
   `this.borrowBookUseCase.execute(dto)` and returns whatever comes back.

2. **Application** — [`loans/application/borrow-book.use-case.ts`](./src/loans/application/borrow-book.use-case.ts)'s
   `BorrowBookUseCase.execute()` orchestrates the steps: load the `Book` via `BookRepositoryPort`,
   load the `Member` via `MemberRepositoryPort`, load the member's active loans via
   `LoanRepositoryPort.findActiveByMemberId()`. Then — and this is the important part — it does
   **not** itself decide whether borrowing is allowed. It calls
   `LoanEligibilityRules.assertCanBorrow(book, activeLoans, now)` and lets the Domain layer throw
   if a rule is violated.

3. **Domain** — [`loans/domain/loan-eligibility.rules.ts`](./src/loans/domain/loan-eligibility.rules.ts)'s
   `LoanEligibilityRules.assertCanBorrow()` runs the 3 borrowing checks in order (availability,
   active-loan cap, overdue block) against the plain `Book` and `Loan[]` objects it was handed.
   If all 3 pass, `book.borrowOneCopy()` (also domain, in
   [`books/domain/book.entity.ts`](./src/books/domain/book.entity.ts)) decrements
   `availableCopies`. None of this code has ever heard of Postgres or HTTP.

4. **Data Access** — back in the use case, `bookRepository.save(book)` and
   `loanRepository.save(loan)` are called against the *ports* (interfaces). At runtime NestJS's
   DI container has bound those ports to
   [`typeorm-book.repository.ts`](./src/books/infrastructure/typeorm-book.repository.ts) and
   [`typeorm-loan.repository.ts`](./src/loans/infrastructure/typeorm-loan.repository.ts) (see the
   `useClass` bindings in each module's `*.module.ts`), which translate the plain domain objects
   into `BookOrmEntity`/`LoanOrmEntity` rows and issue the actual SQL against **Postgres**.

If any rule fails, the Domain layer throws a plain `Error` subclass
(`BookUnavailableError`, `MaxActiveLoansExceededError`, `OverdueLoanExistsError`) — the
Application layer catches those specific types and re-throws them as `ConflictException`
(HTTP 409) with the domain's own message, which is the only place in this flow that HTTP concepts
and domain concepts touch.

## Run it

> **Hosting & deployment:** See [HOSTING.md](./HOSTING.md) for Docker setup, platforms, and
> production notes.

```bash
cp .env.example .env
npm install
docker compose up -d postgres   # or run your own local Postgres
npm run migration:run
npm run start:dev
```

Swagger: `http://localhost:3011/docs`

### Try it

This walkthrough exercises all 4 business rules against a fresh database. Copy the returned
`id` values as you go — env vars make the later commands copy-pasteable.

```bash
BASE=http://localhost:3011

# 1. Catalog a book with only 1 copy
BOOK_ID=$(curl -s -X POST $BASE/books -H 'Content-Type: application/json' \
  -d '{"title":"Clean Architecture","author":"Robert C. Martin","isbn":"9780134494166","totalCopies":1}' \
  | jq -r .id)

# 2. Register a member
MEMBER_ID=$(curl -s -X POST $BASE/members -H 'Content-Type: application/json' \
  -d '{"name":"Ada Lovelace","email":"ada@example.com"}' \
  | jq -r .id)

# 3. Borrow succeeds (1 available copy, 0 active loans, no overdue loans)
curl -s -X POST $BASE/loans -H 'Content-Type: application/json' \
  -d "{\"bookId\":\"$BOOK_ID\",\"memberId\":\"$MEMBER_ID\"}" | jq .
# -> 201, availableCopies on the book is now 0

# 4. Rule 1: borrowing the SAME book again is rejected — 0 copies available
curl -s -X POST $BASE/loans -H 'Content-Type: application/json' \
  -d "{\"bookId\":\"$BOOK_ID\",\"memberId\":\"$MEMBER_ID\"}" | jq .
# -> 409 {"message":"\"Clean Architecture\" has no available copies right now.", ...}

# 5. Catalog 2 more single-copy books and borrow both. The member (who already had 1 active
#    loan from step 3) now reaches the 3-active-loan cap.
BID1=$(curl -s -X POST $BASE/books -H 'Content-Type: application/json' \
  -d '{"title":"Book 1","author":"Author 1","isbn":"0000000001","totalCopies":1}' | jq -r .id)
curl -s -X POST $BASE/loans -H 'Content-Type: application/json' \
  -d "{\"bookId\":\"$BID1\",\"memberId\":\"$MEMBER_ID\"}" > /dev/null

BID2=$(curl -s -X POST $BASE/books -H 'Content-Type: application/json' \
  -d '{"title":"Book 2","author":"Author 2","isbn":"0000000002","totalCopies":1}' | jq -r .id)
curl -s -X POST $BASE/loans -H 'Content-Type: application/json' \
  -d "{\"bookId\":\"$BID2\",\"memberId\":\"$MEMBER_ID\"}" > /dev/null

# 6. Rule 2: a 4th book is rejected by the active-loan cap (member now has exactly 3 active loans)
BID4=$(curl -s -X POST $BASE/books -H 'Content-Type: application/json' \
  -d '{"title":"Book 4","author":"Author 4","isbn":"0000000004","totalCopies":1}' | jq -r .id)
curl -s -X POST $BASE/loans -H 'Content-Type: application/json' \
  -d "{\"bookId\":\"$BID4\",\"memberId\":\"$MEMBER_ID\"}" | jq .
# -> 409 {"message":"Member already has 3 active loan(s) (limit is 3).", ...}

# 7. Rule 4: return one of the active loans — frees up capacity
LOAN_ID=$(curl -s $BASE/members/$MEMBER_ID/loans | jq -r '.[0].id')
RET_BOOK_ID=$(curl -s $BASE/members/$MEMBER_ID/loans | jq -r '.[0].bookId')
curl -s -X POST $BASE/loans/$LOAN_ID/return | jq .
# -> 200, returnedAt is now set

curl -s $BASE/books/$RET_BOOK_ID | jq .availableCopies
# -> 1 (was 0) — returning a book increments availableCopies

# Returning an already-returned loan is rejected too:
curl -s -X POST $BASE/loans/$LOAN_ID/return | jq .
# -> 409 {"message":"Loan ... has already been returned.", ...}

# Borrowing is possible again now that the member has fewer than 3 active loans
curl -s -X POST $BASE/loans -H 'Content-Type: application/json' \
  -d "{\"bookId\":\"$BID4\",\"memberId\":\"$MEMBER_ID\"}" | jq .
# -> 201
```

This exact sequence was run against a live `docker compose up` stack while validating this
project — every status code and message above is copied from a real response, not hand-written.

Rule 3 (overdue block) is time-based, so the fastest, most reliable place to see it enforced is
the pure unit test — `npm test` runs it in milliseconds with a loan whose `dueAt` is constructed
in the past, no waiting required. The Docker walkthrough above shows rules 1, 2, and 4 live end
to end; rule 3 is exercised the same way inside `borrow-book.use-case.ts` (any overdue, unreturned
loan blocks the same code path checked in steps 4–5 above).

## Tests

```bash
npm test
```

This is the actual payoff of the layering: business-rule tests need **no database, no HTTP
server, and no NestJS `TestingModule`** — they `new Book(...)` / `new Loan(...)` directly and
assert. See:

- [`src/loans/domain/loan-eligibility.rules.spec.ts`](./src/loans/domain/loan-eligibility.rules.spec.ts) — all 3 borrowing rules
- [`src/loans/domain/loan.entity.spec.ts`](./src/loans/domain/loan.entity.spec.ts) — overdue detection, return rule
- [`src/books/domain/book.entity.spec.ts`](./src/books/domain/book.entity.spec.ts) — copy-count math
- [`src/members/domain/member.entity.spec.ts`](./src/members/domain/member.entity.spec.ts)

20 tests, all pure, run in a few seconds even on a cold `jest` start — compare that to spinning up
Postgres and a NestJS application context just to check "does borrowing a 4th book fail."

## When this becomes overkill

Five explicit layers, DI tokens, and a repository-interface-per-entity is a lot of ceremony for a
small CRUD app. If your endpoints are really just "validate input, `INSERT`/`SELECT` a row, return
it" with no real business rules to protect, splitting Presentation/Application/Domain into
separate files and interfaces mostly adds indirection you have to jump through on every change,
without buying you anything — there's no complex decision logic worth isolating and unit-testing
in milliseconds. This pattern earns its keep specifically when a domain has non-trivial rules
(like the 4 borrowing rules here) that you want to test in isolation, evolve independently of the
database schema, and keep enforceable no matter which controller or background job ends up
calling into them. For a single `products` table with no business logic beyond "must have a
price," a two-layer controller-plus-repository split is enough — don't build the ceremony until
the rules show up that justify it.

## Related projects

| Project | Relationship |
|---|---|
| `01-modular-monolith` | Splits a codebase into *feature modules* (catalog, basket, ordering); this project splits *one* feature's codebase into *horizontal layers*. The two are complementary — 01's modules could each be internally layered like this. |
| `04-ecom-marketplace-capstone` | A full app combining multiple structural patterns at once. |
