import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration, { AppConfig } from './config/configuration';
import { Category } from './modules/marketplace/entities/category.entity';
import { Product } from './modules/marketplace/entities/product.entity';
import { Order } from './modules/orders/entities/order.entity';
import { OrderItem } from './modules/orders/entities/order-item.entity';
import { UserDirectory } from './modules/auth/entities/user-directory.entity';
import { User } from './modules/users/entities/user.entity';
import { Wallet } from './modules/wallet/entities/wallet.entity';
import { WalletLedgerEntry } from './modules/wallet/entities/wallet-ledger-entry.entity';
import { RedisModule } from './infrastructure/redis/redis.module';
import { RabbitMQModule } from './infrastructure/rabbitmq/rabbitmq.module';
import { ShardingModule } from './sharding/sharding.module';
import { JwtCommonModule } from './common/jwt-common.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { MarketplaceModule } from './modules/marketplace/marketplace.module';
import { OrdersModule } from './modules/orders/orders.module';
import { WorkersModule } from './modules/workers/workers.module';
import { HealthModule } from './modules/health/health.module';

function shardTypeOrmModule(name: 'shard0' | 'shard1' | 'shard2', index: 0 | 1 | 2) {
  return TypeOrmModule.forRootAsync({
    name,
    imports: [ConfigModule],
    inject: [ConfigService],
    useFactory: (config: ConfigService) => {
      const db = config.get<AppConfig['shardDbs']>('shardDbs')![index];
      return {
        type: 'postgres' as const,
        ...db,
        entities: [User, Wallet, WalletLedgerEntry],
        synchronize: false,
      };
    },
  });
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),

    // Primary: Marketplace / Orders / Notifications + the email->shard directory.
    TypeOrmModule.forRootAsync({
      name: 'primary',
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        ...config.get<AppConfig['primaryDb']>('primaryDb')!,
        entities: [Category, Product, Order, OrderItem, UserDirectory],
        synchronize: false,
      }),
    }),

    // Shards: Users + Wallets, sharded by hash(userId) % SHARD_COUNT.
    shardTypeOrmModule('shard0', 0),
    shardTypeOrmModule('shard1', 1),
    shardTypeOrmModule('shard2', 2),

    RedisModule,
    RabbitMQModule,
    ShardingModule,
    JwtCommonModule,

    AuthModule,
    UsersModule,
    WalletModule,
    MarketplaceModule,
    OrdersModule,
    WorkersModule,
    HealthModule,
  ],
})
export class AppModule {}
