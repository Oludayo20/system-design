import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RabbitmqModule } from './common/rabbitmq/rabbitmq.module';
import configuration from './config/configuration';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    RabbitmqModule,
    NotificationsModule,
  ],
})
export class AppModule {}
