# CAP Theorem — AP vs CP Tradeoffs

Project 6 of the system design series. This one demonstrates **Level 7: CAP Theorem** from [`LEVELS-6-7.md`](../LEVELS-6-7.md): when a network partition happens, you cannot have consistency, availability, and partition tolerance all at once.

## Concept, in my own words

CAP theorem sounds intimidating but the setup is simple:

1. You have two database nodes that normally sync
2. The network between them breaks (a **partition**)
3. A write arrives — what do you do?

You must pick:

| Choice | Behavior | Good for |
|---|---|---|
| **CP** (Consistency + Partition tolerance) | Reject writes until nodes can sync | Wallet balances, bank transfers |
| **AP** (Availability + Partition tolerance) | Accept writes locally, sync later | Product view counts, like buttons |

CA (consistency + availability) only works when there is no partition — not realistic in distributed systems.

## What this repo implements

Two in-memory nodes (`A` and `B`) with a partition toggle:

| Endpoint | CAP choice | Behavior during partition |
|---|---|---|
| `POST /profile/view` | **AP** | Accepts increment on node A; node B may lag |
| `POST /wallet/debit` | **CP** | Rejects write — won't risk divergent balances |
| `POST /admin/partition` | — | Toggle `{"enabled": true}` to simulate network split |
| `POST /admin/reconcile` | — | Heal partition and sync nodes |
| `GET /nodes` | — | Inspect both nodes side by side |

## Run it

```bash
cp .env.example .env
npm install
npm run start:dev
```

Swagger: `http://localhost:3006/docs`

### Walkthrough

```bash
# 1. Healthy cluster — both nodes agree
curl http://localhost:3006/nodes

# 2. Simulate a network partition
curl -X POST http://localhost:3006/admin/partition \
  -H 'Content-Type: application/json' \
  -d '{"enabled": true}'

# 3. AP: product view accepted (nodes may disagree)
curl -X POST http://localhost:3006/profile/view
curl http://localhost:3006/nodes
# node A views incremented, node B unchanged

# 4. CP: wallet debit rejected during partition
curl -X POST http://localhost:3006/wallet/debit \
  -H 'Content-Type: application/json' \
  -d '{"amount": 500}'

# 5. Heal the partition
curl -X POST http://localhost:3006/admin/reconcile
curl http://localhost:3006/nodes
```

## How this maps to Oja

| Oja feature | CAP choice | Why |
|---|---|---|
| Product view counter | AP | Showing 1,250 vs 1,251 views briefly is fine |
| Like counts | AP | Eventual consistency (Instagram model) |
| Wallet balance | CP | Must never show ₦5,000 on one server and ₦8,000 on another |
| Order placement | CP | Inventory + payment must agree within a transaction |
| Search index | AP | Slightly stale results are acceptable |

Project **04** shards users/wallets to dedicated Postgres shards partly because wallet data demands stronger consistency guarantees than catalog reads.

## Tests

```bash
npm test
```

`src/cluster/cluster.service.spec.ts` proves AP accepts writes during partition while CP rejects wallet debits.

## Related projects

| Project | Connection to CAP |
|---|---|
| `02-database-sharding` | Sharding increases partition surface area |
| `04-ecom-marketplace-capstone` | Wallets on shards (CP), catalog on primary (more AP-friendly reads) |
| `05-resilience` | What to do when a dependency fails after you've chosen your CAP tradeoff |

Full concept write-up: [`LEVELS-6-7.md`](../LEVELS-6-7.md#level-7--cap-theorem-tradeoffs)
