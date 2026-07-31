/** DI token for the injectable shard count (see ShardingModule / ShardRouterService). */
export const SHARD_COUNT = 'SHARD_COUNT';

export interface AppConfig {
  nodeEnv: string;
  port: number;
  instanceId: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  redisUrl: string;
  rabbitmqUrl: string;
  shardCount: number;
  primaryDb: DbConfig;
  shardDbs: DbConfig[];
}

export interface DbConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

function dbConfig(prefix: string): DbConfig {
  return {
    host: process.env[`${prefix}_DB_HOST`] ?? 'localhost',
    port: Number(process.env[`${prefix}_DB_PORT`] ?? 5432),
    username: process.env[`${prefix}_DB_USER`] ?? 'oja',
    password: process.env[`${prefix}_DB_PASSWORD`] ?? 'oja_dev_password',
    database: process.env[`${prefix}_DB_NAME`] ?? 'oja',
  };
}

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  instanceId: process.env.INSTANCE_ID ?? 'local',
  jwtSecret: process.env.JWT_SECRET ?? 'change_me_in_production_please',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  rabbitmqUrl: process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672',
  shardCount: Number(process.env.SHARD_COUNT ?? 3),
  primaryDb: dbConfig('PRIMARY'),
  shardDbs: [dbConfig('SHARD0'), dbConfig('SHARD1'), dbConfig('SHARD2')],
});
