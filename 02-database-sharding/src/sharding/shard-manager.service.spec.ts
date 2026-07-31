import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../config/configuration';
import { ShardManagerService } from './shard-manager.service';

/**
 * pg.Pool never opens a socket until a query actually runs, so this test
 * exercises real ShardManagerService construction and routing logic without
 * needing a live Postgres instance.
 */
describe('ShardManagerService', () => {
  function buildConfigService(overrides: Partial<AppConfig> = {}): ConfigService<AppConfig, true> {
    const config: AppConfig = {
      port: 3000,
      shardCount: 3,
      shardingStrategy: 'hash',
      shards: [
        {
          host: 'localhost',
          port: 5432,
          database: 'shard_0',
          user: 'postgres',
          password: 'postgres',
        },
        {
          host: 'localhost',
          port: 5433,
          database: 'shard_1',
          user: 'postgres',
          password: 'postgres',
        },
        {
          host: 'localhost',
          port: 5434,
          database: 'shard_2',
          user: 'postgres',
          password: 'postgres',
        },
      ],
      ...overrides,
    };

    return {
      get: (key: keyof AppConfig) => config[key],
    } as unknown as ConfigService<AppConfig, true>;
  }

  afterEach(async () => {
    // pools opened lazily, nothing to tear down between tests here
  });

  it('creates one pool per configured shard', () => {
    const service = new ShardManagerService(buildConfigService());
    expect(service.shardCount).toBe(3);
  });

  it('resolves the doc worked example through the active hash strategy', () => {
    const service = new ShardManagerService(buildConfigService());
    expect(service.resolveShardIndex(15)).toBe(0);
    expect(service.resolveShardIndex(230)).toBe(2);
    expect(service.resolveShardIndex(987)).toBe(0);
    expect(service.resolveShardIndex(1500)).toBe(0);
  });

  it('getPoolForKey returns exactly one pool, never a collection', () => {
    const service = new ShardManagerService(buildConfigService());
    const pool = service.getPoolForKey(15);
    expect(pool).toBeDefined();
    expect(Array.isArray(pool)).toBe(false);
  });

  it('getAllPools exposes all shards for the debug/distribution use case only', () => {
    const service = new ShardManagerService(buildConfigService());
    expect(service.getAllPools()).toHaveLength(3);
  });
});
