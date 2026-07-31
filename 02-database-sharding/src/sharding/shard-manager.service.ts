import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { AppConfig } from '../config/configuration';
import { createShardingStrategy } from './sharding-strategy.factory';
import { ShardResolutionContext, ShardingStrategy } from './sharding-strategy.interface';

/**
 * Owns one `pg.Pool` per physical shard and routes a lookup key to exactly
 * one of them via the active `ShardingStrategy`.
 *
 * This is the piece that makes "one logical database" possible: every other
 * part of the app talks to `ShardManagerService`, never to a shard's pool
 * directly, so nobody can accidentally query the wrong shard - or, worse,
 * every shard - for what should be a single-record lookup.
 *
 * `getAllPools()` exists solely for the distribution/debug endpoint, which
 * is the one legitimate cross-shard operation in this codebase (an
 * operational "how balanced are we?" check, not a request-path query).
 */
@Injectable()
export class ShardManagerService implements OnModuleDestroy {
  private readonly logger = new Logger(ShardManagerService.name);
  private readonly pools: Pool[];
  private readonly strategy: ShardingStrategy;

  constructor(private readonly configService: ConfigService<AppConfig, true>) {
    const shards = this.configService.get('shards', { infer: true });
    const shardCount = this.configService.get('shardCount', { infer: true });
    const strategyName = this.configService.get('shardingStrategy', { infer: true });

    this.pools = shards.map(
      (shard, index) =>
        new Pool({
          host: shard.host,
          port: shard.port,
          database: shard.database,
          user: shard.user,
          password: shard.password,
          max: 10,
          application_name: `shard-router-shard-${index}`,
        }),
    );

    this.strategy = createShardingStrategy(strategyName, shardCount);
    this.logger.log(
      `Sharding strategy "${this.strategy.name}" active across ${this.pools.length} shard(s)`,
    );
  }

  get shardCount(): number {
    return this.pools.length;
  }

  get strategyName(): string {
    return this.strategy.name;
  }

  /** Resolve which shard index owns `key` without touching the network. */
  resolveShardIndex(key: string | number, context?: ShardResolutionContext): number {
    return this.strategy.resolveShard(key, context);
  }

  /**
   * The only way normal query code should reach a database: resolve the
   * single shard that owns `key` and hand back its pool. There is no
   * "give me pool N" method exposed for arbitrary use - callers cannot
   * scatter-gather by accident because they never see the other pools.
   */
  getPoolForKey(key: string | number, context?: ShardResolutionContext): Pool {
    const shardIndex = this.resolveShardIndex(key, context);
    return this.pools[shardIndex];
  }

  /**
   * Cross-shard escape hatch. Intentionally named and documented as such -
   * reach for this only from operational/debug code (e.g. counting rows
   * per shard), never from a hot request path.
   */
  getAllPools(): ReadonlyArray<Pool> {
    return this.pools;
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(this.pools.map((pool) => pool.end()));
  }
}
