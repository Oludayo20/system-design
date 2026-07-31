import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { Category } from '../../modules/marketplace/entities/category.entity';
import { Product } from '../../modules/marketplace/entities/product.entity';
import { Order } from '../../modules/orders/entities/order.entity';
import { OrderItem } from '../../modules/orders/entities/order-item.entity';
import { UserDirectory } from '../../modules/auth/entities/user-directory.entity';

loadEnv();

/**
 * Used both by the TypeORM CLI (`npm run migration:run:primary`) and, with
 * the same connection options, by `TypeOrmModule.forRootAsync({ name: 'primary', ... })`
 * in AppModule. Kept as a plain DataSource (not a Nest provider) here
 * because the CLI runs outside of Nest's DI container entirely.
 */
export const primaryDataSource = new DataSource({
  type: 'postgres',
  host: process.env.PRIMARY_DB_HOST ?? 'localhost',
  port: Number(process.env.PRIMARY_DB_PORT ?? 5432),
  username: process.env.PRIMARY_DB_USER ?? 'oja',
  password: process.env.PRIMARY_DB_PASSWORD ?? 'oja_dev_password',
  database: process.env.PRIMARY_DB_NAME ?? 'oja_primary',
  entities: [Category, Product, Order, OrderItem, UserDirectory],
  migrations: [__dirname + '/migrations/primary/*{.ts,.js}'],
  synchronize: false,
});

export default primaryDataSource;
