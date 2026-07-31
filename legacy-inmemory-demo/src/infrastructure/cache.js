/**
 * A tiny in-memory stand-in for Redis.
 * doc.md: "Redis here is used for things like: Sessions, Cache, Shopping Cart,
 * OTP, Rate Limiting, Frequently viewed products ... Faster."
 */
export class Cache {
  constructor() {
    this.store = new Map();
  }

  set(key, value, ttlMs = 30_000) {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  has(key) {
    return this.get(key) !== undefined;
  }
}
