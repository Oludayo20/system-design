import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RabbitMQModule as GolevelupRabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { DOMAIN_EVENTS_DLX, DOMAIN_EVENTS_EXCHANGE } from './constants';
import { EventBusService } from './event-bus.service';

@Global()
@Module({
  imports: [
    GolevelupRabbitMQModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('rabbitmqUrl')!,
        connectionInitOptions: { wait: false },
        exchanges: [
          { name: DOMAIN_EVENTS_EXCHANGE, type: 'topic', options: { durable: true } },
          // Dead-letter exchange: workers can nack a message without
          // requeue and it lands here instead of vanishing - same
          // retry/DLQ shape as project 03, kept minimal for this demo.
          { name: DOMAIN_EVENTS_DLX, type: 'topic', options: { durable: true } },
        ],
      }),
    }),
  ],
  providers: [EventBusService],
  exports: [EventBusService, GolevelupRabbitMQModule],
})
export class RabbitMQModule {}
