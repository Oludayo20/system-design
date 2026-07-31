export type ShardingStrategyName = 'hash' | 'range' | 'geo';

export interface ShardConnectionConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export interface AppConfig {
  port: number;
  shardCount: number;
  shardingStrategy: ShardingStrategyName;
  shards: ShardConnectionConfig[];
}

function shardConfigFromEnv(index: number): ShardConnectionConfig {
  const prefix = `SHARD_${index}`;
  return {
    host: process.env[`${prefix}_HOST`] ?? 'localhost',
    port: Number(process.env[`${prefix}_PORT`] ?? 5432 + index),
    database: process.env[`${prefix}_DB`] ?? `shard_${index}`,
    user: process.env[`${prefix}_USER`] ?? 'postgres',
    password: process.env[`${prefix}_PASSWORD`] ?? 'postgres',
  };
}

export default (): AppConfig => {
  const shardCount = Number(process.env.SHARD_COUNT ?? 3);

  return {
    port: Number(process.env.PORT ?? 3000),
    shardCount,
    shardingStrategy: (process.env.SHARDING_STRATEGY as ShardingStrategyName) ?? 'hash',
    shards: Array.from({ length: shardCount }, (_, index) => shardConfigFromEnv(index)),
  };
};
