# Shared: How It Works and Why

The `shared/` folder holds utilities used by **multiple modules** that do not belong to any single business domain. Keep this folder small — if only one module needs something, it stays in that module.

---

## `@CurrentUser()` decorator

**How it works:**

1. `JwtAuthGuard` runs before the controller method.
2. `JwtStrategy` validates the token and sets `request.user` to `{ userId, email, roles }`.
3. `@CurrentUser()` extracts `request.user` as a parameter.

```typescript
@Get()
getBasket(@CurrentUser() user: AuthenticatedUser) {
  return this.basketService.getBasket(user.userId);
}
```

**Why a decorator instead of `@Req() request`?**

- Controllers stay focused — no `request.user as AuthenticatedUser` casts.
- Single place to change how user is attached if auth evolves.
- Clear signal: this endpoint requires an authenticated user.

**Why does `shared/` import types from `identity/`?** Identity owns the shape of "logged-in user." The decorator is infrastructure for auth; the type lives with the auth module. Alternative would duplicate an interface in `shared/` — worse duplication.

---

## Swagger error helpers

**Problem:** Swagger showed endpoints without structured request bodies and with error responses that were description-only strings.

**How it works now:**

`api-error-response.dto.ts` defines shapes matching NestJS's built-in exception filter:

```json
// 400 validation
{ "statusCode": 400, "error": "Bad Request", "message": ["email must be an email"] }

// 401 / 404 / etc.
{ "statusCode": 401, "error": "Unauthorized", "message": "Invalid credentials" }
```

`api-error.decorators.ts` provides `@ApiValidationErrors()`, `@ApiUnauthorizedError()`, etc. — each attaches the correct `type:` to `@ApiResponse`.

**Why match Nest's default format?** Swagger docs should reflect what clients actually receive. Custom error shapes would need a global exception filter — this repo uses Nest defaults.

**Why in `shared/` not per module?** Every HTTP module uses the same error envelope. One definition avoids six copies drifting apart.

---

## What should NOT go in `shared/`

| Put in shared | Put in module instead |
|---------------|----------------------|
| `@CurrentUser()` | `RegisterDto`, `BasketView` |
| Generic pagination DTO (if shared) | `OrderCreatedEvent` |
| Swagger error DTOs | Business validation rules |

**Rule of thumb:** If it mentions a business concept (order, product, cart), it belongs in a module. If it's purely HTTP/auth/OpenAPI plumbing, it can be shared.

---

## NestJS Swagger plugin

`nest-cli.json` enables `@nestjs/swagger` compiler plugin with `classValidatorShim: true`.

**How it helps:** Infers `@ApiProperty` from `class-validator` decorators on DTOs, reducing boilerplate.

**Why explicit `@ApiBody` on controllers anyway?** Guarantees request body appears in Swagger UI for every POST/PATCH — plugin inference alone was not reliable enough across all endpoints.
