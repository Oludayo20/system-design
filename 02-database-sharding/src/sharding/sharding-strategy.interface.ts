/**
 * A shard key decides which physical shard stores (or owns) a given record.
 *
 * Every strategy below answers the same question - "given this key, which
 * shard index (0..N-1) is responsible for it?" - using a different rule.
 * The rest of the application never needs to know which rule is active; it
 * only calls `resolveShard` through the active `ShardingStrategy`.
 */
export interface ShardResolutionContext {
  /** Only used by GeoShardingStrategy. Ignored by the others. */
  region?: string;
}

export interface ShardingStrategy {
  /** Human-readable name, mostly useful for logging/debugging. */
  readonly name: string;

  /**
   * Resolve the shard index (0-based) that owns `key`.
   *
   * @param key numeric or string identifier (e.g. a userId)
   * @param context optional extra data some strategies need (e.g. region)
   */
  resolveShard(key: string | number, context?: ShardResolutionContext): number;
}
