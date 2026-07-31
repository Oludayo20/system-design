import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RabbitmqModule } from './infrastructure/rabbitmq/rabbitmq.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { BasketModule } from './modules/basket/basket.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { IdentityModule } from './modules/identity/identity.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OrderingModule } from './modules/ordering/ordering.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('POSTGRES_HOST', 'localhost'),
        port: config.get<number>('POSTGRES_PORT', 5432),
        username: config.get<string>('POSTGRES_USER', 'eshop'),
        password: config.get<string>('POSTGRES_PASSWORD', 'eshop_dev_password'),
        database: config.get<string>('POSTGRES_DB', 'eshop'),
        autoLoadEntities: true,
        // Never true here: schema changes ship as reviewed migrations
        // (src/infrastructure/postgres/migrations), not drift-on-boot.
        synchronize: false,
      }),
    }),

    // Infrastructure
    RedisModule,
    RabbitmqModule,

    // Feature modules (E-Shop naming -> doc.md naming: identity=auth, basket=cart, ordering=orders)
    IdentityModule,
    CatalogModule,
    BasketModule,
    OrderingModule,
    InventoryModule,
    NotificationsModule,
  ],
})
export class AppModule {}
