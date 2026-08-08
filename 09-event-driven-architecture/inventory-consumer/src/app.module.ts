import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RabbitmqModule } from './common/rabbitmq/rabbitmq.module';
import configuration from './config/configuration';
import { StockItem } from './stock/entities/stock-item.entity';
import { StockModule } from './stock/stock.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('database.host'),
        port: config.get<number>('database.port'),
        username: config.get<string>('database.username'),
        password: config.get<string>('database.password'),
        database: config.get<string>('database.name'),
        entities: [StockItem],
        synchronize: config.get<boolean>('database.synchronize'),
      }),
    }),
    RabbitmqModule,
    StockModule,
  ],
})
export class AppModule {}
