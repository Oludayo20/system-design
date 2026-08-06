import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

/**
 * Thin wrapper around the ioredis client. Kept intentionally small: modules depend on this
 * service (never on ioredis directly) so the underlying cache/session store can be swapped
 * without touching module code.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      this.logger.warn(`Failed to parse cached JSON for key "${key}", treating as a cache miss`);
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  async setJson(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    await this.set(key, JSON.stringify(value), ttlSeconds);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    await this.client.expire(key, ttlSeconds);
  }

  getClient(): Redis {
    return this.client;
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
