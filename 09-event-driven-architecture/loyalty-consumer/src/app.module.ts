import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RabbitmqModule } from './common/rabbitmq/rabbitmq.module';
import configuration from './config/configuration';
import { PointsModule } from './points/points.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    RabbitmqModule,
    PointsModule,
  ],
})
export class AppModule {}
