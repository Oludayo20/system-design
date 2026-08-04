# Levels 6 & 7 — Internet-Scale System Design

These are the last two levels of building **internet-scale systems**. They are concepts you usually encounter after you've learned load balancing, caching, sharding, queues, and microservices.

Projects 01–04 in this repo cover modular monoliths, sharding, async queues, and a capstone that combines them. Projects **05** and **06** add the design thinking you need once that foundation is in place.

---

# Level 6 — Resilience

**Resilience means your system keeps working even when parts of it fail.**

In distributed systems, failures are **expected**, not exceptional.

Servers crash.
Databases go down.
Network connections break.
Cloud providers have outages.

A resilient system assumes these things will happen and continues serving users.

---

## Imagine This

You have one API server.

```text
        User
          │
          ▼
     API Server
```

Everything works.

Suddenly...

```text
API Server
    ❌
```

Your whole application is down.

That's **not resilient**.

---

## Instead...

You have two API servers.

```text
            User
              │
              ▼
        Load Balancer
         /         \
        ▼           ▼
   API Server 1  API Server 2
```

If one dies...

```text
Server 1 ❌

Server 2 ✅
```

The load balancer sends all requests to Server 2.

Users may never even notice.

That's resilience.

See project **04** (Nginx + two API replicas) for a runnable version of this pattern.

---

## Understanding the Flow

```text
Request

↓

Primary Service

↓

Timeout

↓

Retry

↓

Replica
```

Imagine:

```text
Flutter App

↓

Payment API
```

The Payment API normally responds.

Today it doesn't.

```text
Payment API

❌ Timeout
```

Instead of immediately showing an error, your application automatically retries another copy.

```text
Flutter

↓

Replica Payment API

↓

Success
```

The user never notices.

---

## What is a Replica?

A replica is simply another copy of the same service.

```text
Order API

↓

Replica 1

Replica 2

Replica 3
```

Each can process requests.

---

## Retry

Instead of giving up immediately:

```text
Call Payment API

↓

Failed

↓

Retry

↓

Succeeded
```

Many failures only last milliseconds.

Retries solve lots of temporary issues.

Project **03** implements broker-level retries and dead-letter queues. Project **05** shows application-level retry + circuit breaking around a flaky payment dependency.

---

## Circuit Breaker

Suppose Payment API is completely dead.

Without a circuit breaker:

```text
Request

↓

Payment API

↓

Timeout

↓

Retry

↓

Timeout

↓

Retry

↓

Timeout
```

Every request wastes several seconds.

Now imagine 100,000 users.

Your whole system becomes slow.

---

### With a Circuit Breaker

```text
Request

↓

Payment API

↓

Fails 5 times

↓

Circuit Opens
```

Now:

```text
Request

↓

Skip Payment API

↓

Return Cached Response

or

Show

"Payment service unavailable."
```

No more waiting.

The circuit periodically checks if the service has recovered before allowing traffic again.

---

## Why Netflix Uses This

Netflix depends on hundreds of services.

```text
Movies

Payments

Profiles

Recommendations

Watch History

Subtitles

Search
```

If one service crashes...

Netflix shouldn't stop working.

Maybe recommendations disappear...

but movies should still play.

That's graceful degradation.

---

## Bad Deployment

Imagine:

You deploy new code.

```text
Version 2

↓

Crash
```

Without replicas:

Everything breaks.

With replicas:

```text
Old Version

↓

Still Running

↓

Traffic switches back
```

This is called a **rollback**.

---

## Flaky Dependencies

Suppose your Email API randomly fails.

```text
Works

Fails

Works

Fails

Works
```

A resilient system:

* retries
* uses queues
* opens circuit breakers
* falls back when possible

---

## How You'd Build This in Oja

Suppose users pay through Paystack.

Instead of:

```text
Checkout

↓

Paystack

↓

Done
```

You could build:

```text
Checkout

↓

Retry 3 Times

↓

If Still Failed

↓

Queue Retry

↓

Notify User
```

Or if you support multiple payment providers:

```text
Checkout

↓

Paystack

↓

Failed

↓

Flutterwave

↓

Success
```

The customer still completes payment.

---

## Resilience Summary

Think of resilience as **always having a backup plan**.

Instead of saying:

> "If this fails, the app dies."

You design:

> "If this fails, use Plan B."

---

# Level 7 — CAP Theorem (Tradeoffs)

This is probably the hardest distributed systems concept.

Fortunately, it's much simpler than it sounds.

---

Imagine you have **two database servers**.

```text
Server A

Server B
```

Normally they communicate.

```text
A  ←────→  B
```

Everything is fine.

---

Now imagine the network cable is cut.

```text
A    X    B
```

Neither server can talk to the other.

This is called a **network partition**.

---

Now a user updates their profile.

They send:

```text
Change Name

↓

Server A
```

Server A updates:

```text
Name = John
```

But...

Server B never receives the update.

It still has:

```text
Name = Johnny
```

Now you have different answers.

Which one is correct?

This is exactly the problem CAP theorem describes.

---

## The Three Letters

### C = Consistency

Everyone always sees the same data.

If I update:

```text
Balance

100

↓

150
```

Every server immediately returns:

```text
150
```

No exceptions.

---

### A = Availability

Every request gets a response.

Even if something is broken.

No waiting.

No errors.

---

### P = Partition Tolerance

The system continues working even if servers can't communicate.

Remember:

```text
Server A

X

Server B
```

The network is broken.

---

## Here's the Catch

When a network partition happens...

You **cannot have all three**.

You must sacrifice one.

---

### Option 1: Consistency + Partition Tolerance (CP)

```text
Update arrives

↓

Servers can't sync

↓

Reject writes

↓

Wait
```

Users may get errors.

But data stays correct.

This is common in banking systems.

---

### Option 2: Availability + Partition Tolerance (AP)

```text
Update arrives

↓

Accept anyway

↓

Sync later
```

Everyone gets a response.

But for a short time...

Server A and Server B may have different data.

Eventually they become consistent.

This is called **eventual consistency**.

Social media often uses this approach.

---

### Option 3: Consistency + Availability (CA)

Only possible if there's **no partition**.

Real distributed systems must assume partitions can happen, so CA isn't a practical choice once multiple nodes are involved.

---

## Example: Instagram Likes

You like a photo.

Server A records it.

Server B hasn't received the update yet.

Friend 1:

```text
Likes

101
```

Friend 2:

```text
Likes

100
```

For a few seconds.

Eventually:

```text
101

Everywhere
```

Instagram chooses **Availability** over immediate Consistency because it's acceptable if like counts briefly differ.

---

## Example: Bank Transfer

You transfer:

```text
$100
```

One database says:

```text
Balance = $900
```

Another says:

```text
Balance = $1000
```

That's unacceptable.

Banks prefer **Consistency** even if it means temporarily rejecting transactions during failures.

---

## How This Applies to Oja

If you're building a marketplace:

### Product Views

Someone viewing a product can tolerate seeing:

```text
1,250 views
```

instead of:

```text
1,251 views
```

Availability is more important than perfect consistency.

---

### Wallet Balance

A wallet cannot show:

```text
₦5,000

or

₦8,000

depending on the server
```

Balances must be correct.

Consistency takes priority.

Project **06** demonstrates AP vs CP behavior with a runnable partition toggle.

---

## Final Picture

By this point, your architecture has evolved from a single server into something much more robust:

```text
                   Cloudflare
                        │
                        ▼
               Nginx Load Balancer
                        │
        ┌───────────────┴───────────────┐
        ▼                               ▼
     API Server 1                   API Server 2
             │                              │
             └──────────────┬───────────────┘
                            ▼
                    PostgreSQL + Redis
                            │
                        RabbitMQ
        ┌──────────────┬──────────────┬──────────────┐
        ▼              ▼              ▼              ▼
   Email Worker   Notification   Analytics    Inventory
                                   Worker        Worker
```

To make this production-ready, you then add:

* **Resilience:** retries, replicas, circuit breakers, health checks, and automatic failover so failures don't take down the system.
* **CAP tradeoffs:** deciding, for each feature, whether immediate consistency or continuous availability matters more when failures occur.

Those two topics aren't about adding another technology. They're about **how you design a distributed system to behave when things inevitably go wrong.**
