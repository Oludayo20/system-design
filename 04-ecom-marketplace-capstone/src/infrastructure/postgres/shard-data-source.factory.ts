import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import { User } from '../../modules/users/entities/user.entity';
import { Wallet } from '../../modules/wallet/entities/wallet.entity';
import { WalletLedgerEntry } from '../../modules/wallet/entities/wallet-ledger-entry.entity';

loadEnv();

/**
 * All three shards share the exact same schema/migrations - only the
 * connection target differs. Centralizing the options here means shard0,
 * shard1 and shard2 data sources (used by both the TypeORM CLI and
 * AppModule) can never drift from one another by accident.
 */
export function buildShardDataSourceOptions(
  envPrefix: 'SHARD0' | 'SHARD1' | 'SHARD2',
): DataSourceOptions {
  return {
    type: 'postgres',
    host: process.env[`${envPrefix}_DB_HOST`] ?? 'localhost',
    port: Number(process.env[`${envPrefix}_DB_PORT`] ?? 5432),
    username: process.env[`${envPrefix}_DB_USER`] ?? 'oja',
    password: process.env[`${envPrefix}_DB_PASSWORD`] ?? 'oja_dev_password',
    database: process.env[`${envPrefix}_DB_NAME`] ?? `oja_${envPrefix.toLowerCase()}`,
    entities: [User, Wallet, WalletLedgerEntry],
    migrations: [__dirname + '/migrations/shard/*{.ts,.js}'],
    synchronize: false,
  };
}

export function buildShardDataSource(envPrefix: 'SHARD0' | 'SHARD1' | 'SHARD2'): DataSource {
  return new DataSource(buildShardDataSourceOptions(envPrefix));
}
