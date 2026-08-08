import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';

// Load .env for local CLI use only; Docker Compose injects env vars directly.
if (process.env.NODE_ENV !== 'production') {
  config();
}

/**
 * Standalone DataSource used only by the TypeORM CLI (migration:generate / migration:run).
 * The running application builds its own connection via TypeOrmModule.forRootAsync in
 * app.module.ts so that it can read config through Nest's ConfigService instead of `process.env`
 * directly. Both configurations must stay in sync.
 *
 * One database, no schema-per-module split (contrast: 01-modular-monolith gives every module
 * its own Postgres schema). Here every module's entities live in the same `public` schema and
 * nothing stops one module's repository from joining straight into another's table — that's the
 * point of this project.
 */
export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.POSTGRES_HOST ?? 'localhost',
  port: Number(process.env.POSTGRES_PORT ?? 5432),
  username: process.env.POSTGRES_USER ?? 'blogstack',
  password: process.env.POSTGRES_PASSWORD ?? 'blogstack_dev_password',
  database: process.env.POSTGRES_DB ?? 'blogstack',
  entities: [__dirname + '/../../modules/**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
};

export default new DataSource(dataSourceOptions);
