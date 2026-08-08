import { NextFunction, Request, Response } from 'express';

interface Bucket {
  tokens: number;
  lastRefillMs: number;
}

/**
 * A minimal per-IP token-bucket rate limiter. Each client IP gets a bucket
 * holding `capacity` tokens; every request costs one token; tokens refill
 * continuously at `refillPerSecond`. When the bucket is empty the gateway
 * returns 429 instead of ever reaching a backend service - this is the
 * kind of cross-cutting concern (auth pass-through, rate limiting, routing)
 * that belongs at the edge exactly once, rather than duplicated inside
 * every one of the four services behind it.
 *
 * In-memory and per-process, which is fine for a single gateway container.
 * A production gateway fronting multiple gateway replicas would move this
 * to Redis (same tradeoff as the circuit breaker note in 05-resilience).
 */
export function createRateLimiter(capacity: number, refillPerSecond: number) {
  const buckets = new Map<string, Bucket>();

  return function rateLimiter(req: Request, res: Response, next: NextFunction): void {
    const key = req.ip ?? 'unknown';
    const now = Date.now();

    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { tokens: capacity, lastRefillMs: now };
      buckets.set(key, bucket);
    }

    const elapsedSeconds = (now - bucket.lastRefillMs) / 1000;
    bucket.tokens = Math.min(capacity, bucket.tokens + elapsedSeconds * refillPerSecond);
    bucket.lastRefillMs = now;

    if (bucket.tokens < 1) {
      res.setHeader('Retry-After', '1');
      res.status(429).json({
        statusCode: 429,
        message: 'Too many requests - slow down.',
      });
      return;
    }

    bucket.tokens -= 1;
    next();
  };
}
