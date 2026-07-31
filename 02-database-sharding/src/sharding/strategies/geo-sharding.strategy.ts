import { ShardResolutionContext, ShardingStrategy } from '../sharding-strategy.interface';

/**
 * Geography-based sharding: map a region code to a shard index via a
 * lookup table, e.g. Africa -> Shard 0, Europe -> Shard 1, Asia -> Shard 2.
 *
 * Beyond distributing load, this strategy also reduces latency: a user in
 * Lagos gets served by a shard that can physically sit in a nearby data
 * center rather than one on another continent.
 *
 * Trade-off: traffic/data volume rarely splits evenly across regions, so
 * this can produce lopsided shards unless the regions themselves are
 * roughly comparable in size (or a region is further split later).
 */
export class GeoShardingStrategy implements ShardingStrategy {
  readonly name = 'geo';

  constructor(
    private readonly regionToShard: Record<string, number>,
    private readonly defaultShard = 0,
  ) {}

  resolveShard(key: string | number, context?: ShardResolutionContext): number {
    const region = context?.region;
    if (!region) {
      throw new Error('GeoShardingStrategy requires a region in the resolution context');
    }

    const normalizedRegion = region.trim().toLowerCase();
    const match = Object.entries(this.regionToShard).find(
      ([knownRegion]) => knownRegion.toLowerCase() === normalizedRegion,
    );

    return match ? match[1] : this.defaultShard;
  }
}
