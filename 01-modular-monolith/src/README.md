# Source Code: How the App Boots and Why It's Organized This Way

Everything under `src/` is the NestJS application. One process handles all HTTP routes and all RabbitMQ consumers.

---

## How the app starts

### `main.ts`

1. `NestFactory.create(AppModule)` — builds dependency injection container.
2. Global `ValidationPipe` — strips unknown JSON fields, validates DTOs, transforms types.
3. Swagger at `/docs` — OpenAPI from decorators on controllers.
4. Listen on `PORT`.

**Why ValidationPipe globally?** Every endpoint gets the same input hygiene without repeating decorators. `forbidNonWhitelisted: true` rejects unexpected fields (basic mass-assignment protection).

### `app.module.ts`

Registers in order:
1. `ConfigModule` (global env)
2. `TypeOrmModule` (Postgres, `synchronize: false`)
3. Infrastructure: `RedisModule`, `RabbitmqModule`
4. Feature modules: Identity → Catalog → Basket → Ordering → Inventory → Notifications

**Why Infrastructure before features?** Feature modules inject `RedisService` and `EventBus` at construction. Infra must be registered first (both are `@Global()` so order is less critical, but readability matters).

**Why Inventory/Notifications imported in AppModule?** Their consumers are providers discovered at boot. Without importing the module, Nest would not instantiate `InventoryConsumer` and no queue binding would exist.

### Docker boot (different from `npm run start:dev`)

```bash
# Wait for postgres TCP
typeorm migration:run
node dist/main.js
```

Migrations run **outside** Nest because the CLI uses `data-source.ts`, not `AppModule`. Schema must exist before TypeORM entities are queried.

---

## Why `modules/` + `infrastructure/` + `shared/`

| Folder | Contains | Analogy |
|--------|----------|---------|
| `modules/` | Business capabilities | "What the app does" |
| `infrastructure/` | DB, cache, message broker adapters | "What the app plugs into" |
| `shared/` | Auth decorator, Swagger helpers | "Glue used everywhere" |

**Anti-pattern avoided:** `src/controllers/`, `src/services/`, `src/repositories/` where OrderService and ProductService live side by side and import each other freely.

---

## How a typical HTTP request flows

```
HTTP → main.ts (ValidationPipe)
     → Controller (JwtAuthGuard if protected)
     → Service (business logic)
     → Repository and/or RedisService and/or other module's Service
     → Response DTO
```

## How an event-driven flow runs (same process)

```
OrderingService.placeOrder()
     → EventBus.publish()
     → RabbitMQ
     → InventoryConsumer / NotificationsConsumer (async handlers)
```

Same Node process, different trigger. Consumers are not cron jobs or separate threads — they're async functions invoked when messages arrive.

---

## Configuration

All env vars via `@nestjs/config`. See `.env.example`.

**Why not hardcode connection strings?** Docker uses service hostnames (`postgres`, `redis`, `rabbitmq`); local dev uses `localhost`. Same code, different `.env`.

**Why `data-source.ts` skips dotenv in production?** Docker Compose injects env vars directly. Loading `.env` in production could override container config unexpectedly.

---

## Documentation map

| Topic | Document |
|-------|----------|
| Big picture + checkout story | [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) |
| Module boundaries | [modules/README.md](./modules/README.md) |
| Postgres / Redis / RabbitMQ | [infrastructure/README.md](./infrastructure/README.md) |

Each module and infrastructure subfolder has its own README explaining **how that part works** and **why it was built that way**.
