Sunday 8:57 PM
Explain this
Explain this also
Wednesday 9:21 AM
Explain this

This image ties together almost everything we've discussed: modular monoliths, RabbitMQ, Redis, PostgreSQL, and APIs. It's a great example of how a modern backend can be structured without immediately adopting microservices.

Let's go through it piece by piece.

The Big Picture

The application shown is an e-commerce system.

Think of Shopify itself.

Instead of one giant messy codebase:

app.js

10,000 lines

Everything mixed together

It is organized into modules.

E-Shop

├── Catalog
├── Basket
├── Ordering
├── Identity

It's still one application.

Still one deployment.

Still one repository.

But internally it's clean.

Single Codebase

This means:

github.com/shopify

↓

One Repository

Everything lives together.

src/

catalog/

basket/

orders/

users/

payments/

notifications/

One command deploys everything.

docker build .

docker run ...

No separate deployments.

What is a Module?

A module is an independent business area.

For an e-commerce app:

Catalog

Responsible for:

Products
Categories
Search
Product Images

Nothing else.

Basket

Responsible for:

Add to Cart
Remove from Cart
Cart Totals
Coupons
Ordering

Responsible for:

Place Order
Cancel Order
Order History
Identity

Responsible for:

Login
Registration
JWT
Roles
Permissions

Each module owns its logic.

Notice the Arrows

The arrows show modules communicating.

Instead of:

Ordering

↓

InventoryService.update()

↓

EmailService.send()

↓

Notification.send()

they communicate through events.

Example:

Order Created

Ordering publishes:

OrderCreated

Basket doesn't care.

Catalog doesn't care.

Email doesn't care.

Only interested modules react.

RabbitMQ at the Bottom

This is very important.

Even though everything is in one codebase...

They're still communicating asynchronously.

Ordering

↓

RabbitMQ

↓

Inventory

↓

Email

↓

Analytics

This gives you all the advantages of microservices...

without actually splitting the application.

Why use RabbitMQ inside one application?

Imagine this.

Customer places an order.

Immediately:

Create Order

takes 150ms.

Then:

Send Email

takes 5 seconds.

If you do:

await createOrder();

await sendEmail();

The user waits.

Instead:

Create Order

↓

RabbitMQ

↓

Return Success

↓

Email Worker

↓

Send Email

The API responds almost instantly.

The email is processed in the background.

PostgreSQL

Every module stores its data.

Catalog

↓

Products Table
Orders

↓

Orders Table
Identity

↓

Users Table

In this example, they're all using PostgreSQL.

Some modular monoliths use a single shared database but keep tables grouped by module. Others go further and give each module its own schema to strengthen boundaries.

Redis

Redis here is used for things like:

Sessions
Cache
Shopping Cart
OTP
Rate Limiting
Frequently viewed products

Suppose someone visits:

/products

Instead of PostgreSQL:

Redis

↓

Product Found

↓

Return

Faster.

API

Everything begins here.

Phone

↓

API

↓

Ordering Module

The API decides which module should handle the request.

Example:

POST /orders

↓

Ordering Module

or

GET /products

↓

Catalog Module

The API is just the entry point.

Docker

The Docker logo indicates the application is packaged into a container.

Instead of:

Install Node

Install PostgreSQL

Install Redis

Configure Linux

you run:

docker compose up

Everything starts.

Why "Monolith ≠ Messy"

Many people think:

Monolith

=

Bad

That's not true.

There are two types.

Bad Monolith
src/

controllers/

helpers/

utils/

services/

everything calling everything

Nothing is separated.

Changing one file breaks ten others.

Modular Monolith
src/

modules/

catalog/

basket/

ordering/

identity/

Each module has:

Controllers

Services

Repositories

Entities

Events

The Ordering module cannot directly manipulate Catalog internals. It uses public interfaces or publishes events.

Very organized.

How a Request Flows

Suppose you buy a laptop.

Customer

↓

POST /orders

↓

API

↓

Ordering Module

↓

Save Order (PostgreSQL)

↓

Publish OrderCreated

↓

RabbitMQ

Then, in parallel:

Inventory Module

↓

Reduce Stock
Email Module

↓

Send Receipt
Analytics Module

↓

Record Sale
Notification Module

↓

Send Push

The customer already received:

{
  "success": true
}

while those background tasks continue independently.

What Would This Look Like in NestJS?

A structure could look like this:

src/
│
├── modules/
│   ├── auth/
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── auth.module.ts
│   │   └── events/
│   │
│   ├── users/
│   ├── catalog/
│   ├── cart/
│   ├── orders/
│   ├── payments/
│   ├── inventory/
│   └── notifications/
│
├── infrastructure/
│   ├── postgres/
│   ├── redis/
│   ├── rabbitmq/
│   └── cache/
│
├── shared/
│
└── main.ts

This is a single NestJS application, but each module has a clear responsibility.

Why Shopify Uses This

A modular monolith gives many of the benefits developers want:

Easier to develop because everything is in one repository.
Easier to debug because you can run the whole application locally.
Cleaner than a traditional monolith because modules have strict boundaries.
Easier to evolve because, if one module eventually needs to become its own service, it's already isolated.

For example, if your Notification module starts processing millions of emails and push notifications every day, you can extract just that module into a separate microservice while leaving the rest of the application unchanged.

If you were building Oja or Skoo today

Given the kinds of products you've been building, I would structure them as:

API
 │
 ├── Auth Module
 ├── User Module
 ├── School Module
 ├── Marketplace Module
 ├── Order Module
 ├── Wallet Module
 ├── Payment Module
 ├── Notification Module
 ├── Chat Module
 └── Admin Module
        │
        ▼
 Internal Event Bus / RabbitMQ
        │
        ▼
 Email Workers
 Push Notification Workers
 Analytics Workers
        │
        ▼
Redis (Cache & Sessions)
        │
        ▼
PostgreSQL

This architecture is robust enough to support a growing SaaS application while remaining much simpler to operate than a full microservices ecosystem. When a specific module outgrows the monolith, you can extract it with minimal disruption because you've already established clear boundaries and event-based communication.

Yesterday 3:54 PM
Explain this

This diagram explains database sharding, which is one of the most advanced scaling techniques used by companies like Instagram, TikTok, Facebook, Amazon, and Uber.

The basic idea is:

Instead of storing all your data in one database server, split it across multiple database servers.

This becomes necessary when one database can no longer handle the amount of data or traffic.

Start with One Database

Imagine you're building Instagram.

At first, you have:

           App
            │
            ▼
      PostgreSQL

Every user...

signs up
uploads photos
comments
likes posts
follows people

Everything goes into one database.

It works fine.

Then You Grow

Now imagine Instagram has:

10 million users
1 billion photos
50 billion likes
100 billion comments

Your database now looks like this:

Users
Photos
Likes
Comments
Messages
Notifications

All inside one server.

Eventually:

Disk fills up
CPU stays at 100%
RAM becomes insufficient
Queries become slow

Adding more CPU and RAM (vertical scaling) eventually reaches physical and financial limits.

The Solution: Sharding

Instead of one huge database:

          Database

you split it into smaller databases.

         Database

      /      |      \

 Shard 1  Shard 2  Shard 3

Each shard stores only part of the data.

Think of a Library

Imagine a library with 10 million books.

Without sharding:

Library

Shelf

10 million books

Finding a book becomes slow.

Instead:

Shelf A

A-F

Shelf B

G-M

Shelf C

N-Z

Now every shelf has fewer books.

Searching is much faster.

That's exactly what sharding does.

How Are Records Split?

This depends on the shard key.

A shard key is the rule used to decide which shard stores a record.

There are several strategies.

Strategy 1: User ID (Most Common)

Suppose your users are:

User 1

User 2

User 3

...

User 10,000,000

You can split them.

Shard 1

Users

1 - 3,000,000
Shard 2

Users

3,000,001 - 6,000,000
Shard 3

Users

6,000,001+
Strategy 2: Hashing

Instead of ranges:

hash(userId)

↓

0 → Shard 1

1 → Shard 2

2 → Shard 3

This distributes users more evenly.

Strategy 3: Geography

Instagram could do:

Africa

↓

Shard 1
Europe

↓

Shard 2
Asia

↓

Shard 3

This also helps reduce latency because users are often served by databases closer to them.

Example

Suppose these users exist.

User 15

User 230

User 987

User 1500

Using:

userId % 3

You get:

15 → Shard 0

230 → Shard 2

987 → Shard 0

1500 → Shard 0

The application automatically knows where to read and write each user's data.

What Happens When Someone Logs In?

Suppose:

User ID

923456

Application:

hash(923456)

↓

Shard 2

Only Shard 2 is queried.

Not all shards.

Very fast.

Why Is This Faster?

Imagine one database handling:

1 Billion Users

Every query searches enormous indexes and competes with millions of other queries.

Now imagine ten shards.

Each shard contains:

100 Million Users

Each database has:

smaller indexes
less data
lower CPU usage
less disk I/O

Queries complete faster because each server has less work to do.

What About Instagram Photos?

Instagram stores billions of photos.

Without sharding:

Photos Table

5 Billion Rows

That becomes extremely difficult to manage.

Instead:

Shard 1

500 Million Photos
Shard 2

500 Million Photos
Shard 3

500 Million Photos

...and so on.

Each server manages only a fraction of the total data.

Where Does the App Fit?

The application is responsible for routing requests to the correct shard.

              App

                │

      Find User 923

                │

      Which shard?

                │

          Shard 2

The user doesn't know there are multiple databases behind the scenes.

Sharding vs Replication

People often confuse these.

Replication

Every database has the same data.

Primary Database

↓

Replica 1

↓

Replica 2

↓

Replica 3

Purpose:

increase read capacity
improve availability
provide backups

Each replica is a copy of the primary.

Sharding

Every database has different data.

Shard 1

Users 1-1M
Shard 2

Users 1M-2M
Shard 3

Users 2M-3M

Purpose:

store more data
distribute writes
reduce load on a single database
Real Example: Your Oja Marketplace

Imagine Oja grows to 100 million users.

Instead of:

One PostgreSQL

Users

Products

Orders

Chats

Wallets

you could shard by userId.

Shard 1

Users

1-10M
Shard 2

Users

10M-20M
Shard 3

Users

20M-30M

When User 15,345,678 logs in:

App

↓

Calculate Shard

↓

Shard 2

↓

Return User

Only one database is queried.

Does this mean one PostgreSQL database?

The image says "One database", but what it really means is one logical database, not one physical database.

To your application, it feels like:

Database

Behind the scenes, it's actually:

Logical Database

      │

 ┌────┼────┐
 │    │    │
 ▼    ▼    ▼
Shard1 Shard2 Shard3

The application or a routing layer decides which shard to use, so developers often think of it as one database even though it's spread across many servers.

When should you think about sharding?

Not at the beginning.

A typical evolution looks like this:

Stage 1
──────────────
One PostgreSQL Database

↓

Stage 2
──────────────
Add Redis Cache

↓

Stage 3
──────────────
Add Read Replicas

↓

Stage 4
──────────────
Partition large tables if needed

↓

Stage 5
──────────────
Shard the database

Most SaaS applications never reach Stage 5. You can serve millions of users with a well-designed single PostgreSQL database, proper indexing, caching (Redis), read replicas, and optimized queries. Sharding adds significant complexity, so it's usually adopted only when you've genuinely outgrown those simpler scaling techniques.

Yesterday 5:39 PM
Explain this

This image explains asynchronous processing using queues, which is one of the most important concepts in backend engineering.

The core idea is:

Don't make users wait for slow tasks. Put those tasks in a queue and process them later.

This is exactly what companies like Uber, Amazon, Stripe, Shopify, and Instagram do.

The Problem

Imagine you finish an Uber ride.

The app needs to:

Save the trip
Charge your card
Generate a receipt
Send an email
Update analytics
Award loyalty points
Notify the driver

If Uber waits for everything before responding:

Finish Ride

↓

Save Trip (100ms)

↓

Charge Card (500ms)

↓

Generate PDF Receipt (2s)

↓

Send Email (3s)

↓

Update Analytics (1s)

↓

Return Success

The rider waits 6–7 seconds.

That's a bad experience.

The Async Solution

Instead:

Finish Ride

↓

Save Trip

↓

Queue Background Jobs

↓

Return Success (200ms)

The rider immediately sees:

✅ Trip Completed

Meanwhile:

Queue

↓

Receipt Worker

↓

Send Email

↓

Analytics Worker

↓

Update Dashboard

↓

Loyalty Worker

↓

Award Points

Everything happens after the user has already received a response.

Understanding the Diagram

The diagram shows three parts.

Producer

↓

Queue

↓

Consumer

Let's explain each one.

Producer

The producer is the application creating work.

Example:

Your Order Service.

Customer

↓

POST /orders

↓

Order Service

Instead of:

await sendEmail();

it says:

Create a job:

Send Receipt

and places it into the queue.

Producer

↓

Queue
Queue

The queue is simply a waiting line.

Imagine a supermarket.

Customer A

Customer B

Customer C

They wait in line.

The cashier processes them one by one.

A message queue works the same way.

Email Job 1

Email Job 2

Email Job 3

Email Job 4

Workers process them as resources become available.

Consumer (Worker)

Consumers continuously watch the queue.

Queue

↓

Worker

↓

Process Job

For example:

while (true) {

    const job = queue.getNextJob();

    sendEmail(job);

}

The consumer runs independently from your API.

Real E-commerce Example

A customer places an order.

Without a queue:

Order API

↓

Save Order

↓

Send Email

↓

Generate Invoice

↓

Notify Warehouse

↓

Update Analytics

↓

Return Success

Maybe 8 seconds.

With RabbitMQ:

Order API

↓

Save Order

↓

RabbitMQ

↓

Return Success

Background:

RabbitMQ

├── Email Worker

├── Invoice Worker

├── Warehouse Worker

└── Analytics Worker

Each worker processes its own type of job.

Why is this called Asynchronous?

Because the producer doesn't wait.

Instead of:

await sendEmail();

you do:

queue.publish({
    type: "SEND_EMAIL",
    email: user.email
});

Immediately after publishing:

return {
    success: true
};

The producer is finished.

The worker handles the email later.

RabbitMQ

RabbitMQ is a message broker.

Think of it as a smart post office.

Producer

↓

RabbitMQ

↓

Worker 1

Worker 2

Worker 3

RabbitMQ stores messages until workers process them.

Great for:

Emails
SMS
Notifications
Image processing
Invoice generation
PDF creation
Example
await rabbit.publish("emails", {

    email: "john@gmail.com",

    template: "receipt"

});

Later:

rabbit.subscribe("emails", async job => {

    await sendEmail(job.email);

});
Kafka

Kafka is different.

RabbitMQ focuses on:

Completing tasks.

Kafka focuses on:

Broadcasting events.

Example:

Order Created

↓

Kafka

↓

Inventory

↓

Analytics

↓

Fraud Detection

↓

Recommendation Engine

Many services can consume the same event independently.

Kafka also stores events for a long time, allowing new consumers to replay history.

RabbitMQ vs Kafka
RabbitMQ	Kafka
Best for background jobs	Best for event streaming
Removes messages after processing (typically)	Retains events for replay
Queues	Topics
Task distribution	Event distribution
Emails, notifications	Analytics, activity streams
AWS Lambda

Lambda is another way to run background work.

Instead of running your own worker:

RabbitMQ

↓

Your Server

↓

Worker

AWS can execute code for you.

Queue

↓

AWS Lambda

↓

Runs Function

↓

Stops

You only pay while the function is executing.

Handling Traffic Spikes

Imagine a flash sale.

Normally:

100 emails/minute

Suddenly:

100,000 emails/minute

Without a queue:

Your API tries to send every email immediately.

The server crashes.

With RabbitMQ:

100,000 Jobs

↓

Queue

↓

20 Workers

↓

Jobs gradually processed

Your API stays responsive because it only adds jobs to the queue.

Retrying Failed Jobs

Suppose an email service is temporarily unavailable.

Without a queue:

Send Email

↓

Failed

↓

Lost forever

With RabbitMQ:

Send Email

↓

Failed

↓

Retry after 30 seconds

↓

Success

Most queue systems support:

Automatic retries
Delayed retries
Dead Letter Queues (DLQ) for permanently failed jobs
How This Fits Into Everything You've Learned

Let's combine the concepts from the previous images.

                    User
                      │
                      ▼
               Cloudflare (CDN)
                      │
                      ▼
            Nginx Load Balancer
                      │
        ┌─────────────┴─────────────┐
        ▼                           ▼
     API Server 1               API Server 2
              │
              ▼
      PostgreSQL + Redis
              │
      Customer places order
              │
              ▼
      Publish "OrderCreated"
              │
              ▼
           RabbitMQ
      ┌────────┼────────┬────────┐
      ▼        ▼        ▼        ▼
 Email     Inventory  Analytics  Notifications
 Worker      Worker     Worker      Worker

Here's what happens:

The user sends a request.
The load balancer sends it to one API server.
The API stores the order in PostgreSQL.
It may use Redis for caching.
Instead of performing every follow-up task immediately, it publishes jobs to RabbitMQ.
Background workers process those jobs independently.

The user gets a response in a few hundred milliseconds, while emails, notifications, analytics, and inventory updates continue in the background.

A Complete NestJS Example

Suppose you're building your marketplace.

Order Module

@Post()
async createOrder(dto: CreateOrderDto) {
    const order = await this.orderService.create(dto);

    await this.rabbit.publish("order.created", {
        orderId: order.id
    });

    return order;
}

The client immediately receives:

{
  "success": true,
  "orderId": 123
}

Meanwhile, different workers react:

RabbitMQ
   │
   ├── Email Worker
   │      → Send receipt
   │
   ├── Inventory Worker
   │      → Reduce stock
   │
   ├── Notification Worker
   │      → Send push notification
   │
   └── Analytics Worker
          → Record sale

Notice that none of these background tasks slow down the API response. That's the power of asynchronous processing and why it's a cornerstone of scalable backend systems.




