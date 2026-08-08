import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import { SubscriptionOrmEntity } from './subscription.orm-entity';

// Load .env for local CLI use only; Docker Compose injects env vars directly.
if (process.env.NODE_ENV !== 'production') {
  config();
}

/**
 * Standalone DataSource used by the TypeORM CLI (migration:generate / migration:run) and by the
 * CLI adapter when REPOSITORY=postgres. The running HTTP app builds its own connection via
 * TypeOrmModule.forRootAsync in app.module.ts so it can read config through Nest's ConfigService.
 * Both configurations must stay in sync.
 */
export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.POSTGRES_HOST ?? 'localhost',
  port: Number(process.env.POSTGRES_PORT ?? 5432),
  username: process.env.POSTGRES_USER ?? 'orbit',
  password: process.env.POSTGRES_PASSWORD ?? 'orbit_dev_password',
  database: process.env.POSTGRES_DB ?? 'orbit',
  entities: [SubscriptionOrmEntity],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
};

export default new DataSource(dataSourceOptions);
