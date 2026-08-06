# Notifications Module: How It Works and Why

Notifications has **no HTTP API**. It simulates sending a receipt email when an order is placed. The entire module exists to prove one point: **slow work must not run on the checkout request path**.

---

## The latency problem

| Operation | Typical duration |
|-----------|------------------|
| Save order to Postgres | ~50–200 ms |
| Send email via external API | ~2–10 seconds |

If `OrderingService.placeOrder()` awaited email delivery:

```typescript
await saveOrder();
await sendEmail();  // blocks 5+ seconds
return { success: true };
```

The customer stares at a loading spinner for five seconds after clicking "Place order." Timeouts, retries, and provider outages would **fail checkout** even though the order was saved.

---

## How this module works

`NotificationsConsumer.handleOrderCreated()`:

1. Receive `order.created` from queue `notifications.order_created`.
2. Log: `Sending receipt email for order ... (simulated, ~5s)...`
3. `await delay(5000)` — stands in for HTTP call to SendGrid/SES/etc.
4. Log: `Receipt email sent for order ..., total $X`

No real email is sent. The delay is intentional and visible in logs.

**Why simulate 5 seconds?** So you can **see** the gap between HTTP response and email completion when running `docker compose logs -f api`. Without artificial delay, both would appear instant and the lesson would be lost.

---

## How to observe the behavior

1. `POST /orders` with a valid Bearer token.
2. Note the immediate JSON response: `{ "success": true, "orderId": "..." }`.
3. Watch logs:
   - Ordering log appears immediately.
   - Inventory logs appear within milliseconds.
   - Notifications "Sending..." appears after response.
   - "Receipt email sent" appears **~5 seconds later**.

That gap is the architectural win.

---

## Why Notifications does not call Ordering or Catalog

The event payload already contains `orderId`, `userId`, `total`, and line items with names and prices.

**Why self-contained events matter here:** A receipt email needs "what did you buy and for how much?" If Notifications had to call `GET /orders/:id`, it would:
- Create a synchronous dependency on Ordering's HTTP API
- Fail if Ordering is down (email shouldn't fail because read API is slow)
- Complicate extraction to a separate service

The publisher (Ordering) is responsible for putting enough data in the event for subscribers to act autonomously.

---

## Why same routing key, different queue as Inventory

Both subscribe to `order.created` on `domain_events` exchange:

| Queue | Module | Work |
|-------|--------|------|
| `inventory.order_created` | Inventory | Fast stock update |
| `notifications.order_created` | Notifications | Slow email |

**Why not one consumer that does both?** Couples unrelated concerns. Email retry policy differs from stock retry policy. Teams differ (platform vs growth). One queue per consumer is the standard messaging pattern.

---

## Why no `notifications` schema in Postgres

This demo does not store "email sent at T" or notification history.

**Why?** Scope. Production would add:
- `notifications.outbox` or event log for audit
- Idempotency: `processed_events(orderId, consumer)` to skip duplicates
- DLQ for failed sends after N retries

The module structure (consumer + queue binding) is the same; persistence layers on top.

---

## Extracting to a real email service

Replace `delay(5000)` with:

```typescript
await this.emailProvider.send({
  to: userEmail,  // would need email in event or Identity lookup
  subject: `Order ${orderId} confirmed`,
  body: renderReceipt(payload),
});
```

Ordering code unchanged. Only this consumer changes. Optionally move to separate repo/container that only knows RabbitMQ + email API.

---

## Key files

| File | What it does |
|------|--------------|
| `notifications.consumer.ts` | Simulated email handler |
| `notifications.module.ts` | Registers consumer; no Catalog/Basket imports |
