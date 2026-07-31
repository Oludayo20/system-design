import { ShardingStrategyName } from '../config/configuration';
import { GeoShardingStrategy } from './strategies/geo-sharding.strategy';
import { HashShardingStrategy } from './strategies/hash-sharding.strategy';
import { RangeShardingStrategy } from './strategies/range-sharding.strategy';
import { ShardingStrategy } from './sharding-strategy.interface';

/**
 * Range boundaries mirroring the doc's Oja example: Shard 0 = users 1-10M,
 * Shard 1 = 10M-20M, Shard 2 = 20M-30M. Extended generically for
 * `shardCount` shards of 10M users each.
 */
function buildDefaultRangeBoundaries(shardCount: number): number[] {
  const boundaries: number[] = [];
  for (let i = 1; i < shardCount; i++) {
    boundaries.push(i * 10_000_000);
  }
  boundaries.push(Infinity);
  return boundaries;
}

/** Region -> shard index, mirroring the doc's Africa/Europe/Asia example. */
const DEFAULT_GEO_MAP: Record<string, number> = {
  africa: 0,
  europe: 1,
  asia: 2,
};

export function createShardingStrategy(
  strategyName: ShardingStrategyName,
  shardCount: number,
): ShardingStrategy {
  switch (strategyName) {
    case 'hash':
      return new HashShardingStrategy(shardCount);
    case 'range':
      return new RangeShardingStrategy(buildDefaultRangeBoundaries(shardCount));
    case 'geo':
      return new GeoShardingStrategy(DEFAULT_GEO_MAP);
    default:
      throw new Error(`Unknown sharding strategy: ${strategyName as string}`);
  }
}
