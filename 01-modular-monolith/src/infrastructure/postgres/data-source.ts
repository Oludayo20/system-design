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
 */
export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.POSTGRES_HOST ?? 'localhost',
  port: Number(process.env.POSTGRES_PORT ?? 5432),
  username: process.env.POSTGRES_USER ?? 'eshop',
  password: process.env.POSTGRES_PASSWORD ?? 'eshop_dev_password',
  database: process.env.POSTGRES_DB ?? 'eshop',
  entities: [__dirname + '/../../modules/**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
};

export default new DataSource(dataSourceOptions);
