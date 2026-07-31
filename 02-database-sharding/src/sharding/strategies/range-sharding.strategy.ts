import { ShardResolutionContext, ShardingStrategy } from '../sharding-strategy.interface';

/**
 * Range-based sharding: bucket numeric IDs into configurable contiguous
 * windows, e.g. Users 1-3,000,000 -> Shard 0, 3,000,001-6,000,000 -> Shard 1,
 * 6,000,001+ -> Shard 2.
 *
 * Simple to reason about and easy to debug ("where does user 4.2M live?
 * shard 1"), but it concentrates all *new* writes on whichever shard owns
 * the current upper end of the range. If IDs are assigned sequentially
 * (the common case for auto-incrementing primary keys), the newest shard
 * becomes a hot shard while older shards sit comparatively idle.
 *
 * Boundaries are given as ascending upper bounds. The last boundary should
 * usually be Infinity so every key resolves to a shard.
 *
 * Example: boundaries = [3_000_000, 6_000_000, Infinity]
 *   id <= 3,000,000                -> shard 0
 *   3,000,000 < id <= 6,000,000    -> shard 1
 *   id > 6,000,000                 -> shard 2
 */
export class RangeShardingStrategy implements ShardingStrategy {
  readonly name = 'range';

  constructor(private readonly upperBounds: number[]) {
    if (upperBounds.length === 0) {
      throw new Error('upperBounds must contain at least one boundary');
    }
    for (let i = 1; i < upperBounds.length; i++) {
      if (upperBounds[i] <= upperBounds[i - 1]) {
        throw new Error('upperBounds must be strictly ascending');
      }
    }
  }

  resolveShard(key: string | number, _context?: ShardResolutionContext): number {
    const numericKey = typeof key === 'number' ? key : Number(key);
    if (Number.isNaN(numericKey)) {
      throw new Error(`RangeShardingStrategy requires a numeric key, got "${key}"`);
    }

    for (let shardIndex = 0; shardIndex < this.upperBounds.length; shardIndex++) {
      if (numericKey <= this.upperBounds[shardIndex]) {
        return shardIndex;
      }
    }

    // Key exceeds every configured boundary - route to the last shard.
    return this.upperBounds.length - 1;
  }
}
