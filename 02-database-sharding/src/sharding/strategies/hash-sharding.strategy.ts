import { ShardResolutionContext, ShardingStrategy } from '../sharding-strategy.interface';

/**
 * Hash-based sharding: `hash(key) % shardCount`.
 *
 * This is the default strategy used across the demo because it distributes
 * records evenly across shards regardless of insertion order - unlike range
 * sharding, it doesn't create a "hot" shard while IDs are climbing through
 * a single numeric window.
 *
 * For numeric keys (the common case - userId) we deliberately do NOT hash
 * the number first: modulo is already a perfectly uniform distribution over
 * sequential integers, and using the raw value keeps the doc's worked
 * example reproducible bit-for-bit: `userId % 3`.
 *   15   % 3 = 0
 *   230  % 3 = 2
 *   987  % 3 = 0
 *   1500 % 3 = 0
 *
 * For string keys (e.g. an email used as a shard key) we first fold the
 * string down to a stable 32-bit integer via djb2, then apply the same
 * modulo. djb2 is not cryptographic - it's chosen because it's simple,
 * deterministic across processes/languages, and fast.
 */
export class HashShardingStrategy implements ShardingStrategy {
  readonly name = 'hash';

  constructor(private readonly shardCount: number) {
    if (shardCount < 1) {
      throw new Error('shardCount must be >= 1');
    }
  }

  resolveShard(key: string | number, _context?: ShardResolutionContext): number {
    const numericKey = typeof key === 'number' ? key : this.djb2(key);
    return this.mod(numericKey, this.shardCount);
  }

  private djb2(input: string): number {
    let hash = 5381;
    for (let i = 0; i < input.length; i++) {
      hash = (hash * 33) ^ input.charCodeAt(i);
    }
    // >>> 0 forces an unsigned 32-bit integer
    return hash >>> 0;
  }

  /** JS's `%` can return negative results for negative operands; normalize. */
  private mod(value: number, divisor: number): number {
    return ((value % divisor) + divisor) % divisor;
  }
}
