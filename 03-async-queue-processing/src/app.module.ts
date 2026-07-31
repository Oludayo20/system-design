import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from './config/configuration';
import { RabbitmqModule } from './common/rabbitmq/rabbitmq.module';
import { Ride } from './rides/entities/ride.entity';
import { RidesModule } from './rides/rides.module';

/** Producer process: HTTP API only. Never imports WorkersModule. */
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
        entities: [Ride],
        synchronize: config.get<boolean>('database.synchronize'),
      }),
    }),
    RabbitmqModule,
    RidesModule,
  ],
})
export class AppModule {}
