/**
 * A shard key decides which physical shard owns a given record.
 *
 * The rest of the application never needs to know how the decision is made -
 * it only calls `resolveShard` on whichever strategy is active.
 */
export interface ShardingStrategy {
  /** Human-readable name, useful for logging. */
  readonly name: string;

  /** Number of shards this strategy distributes across. */
  readonly shardCount: number;

  /**
   * Resolve the shard index (0-based) that owns `key`.
   *
   * @param key numeric or string identifier (e.g. a userId)
   */
  resolveShard(key: string | number): number;
}
