import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RabbitMQModule as GolevelupRabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { DOMAIN_EVENTS_EXCHANGE } from './rabbitmq.constants';
import { EventBus } from './event-bus.service';

/**
 * Wraps @golevelup/nestjs-rabbitmq so the rest of the app never imports that package directly.
 * Declares the `domain_events` topic exchange as code (topology-as-code) — every queue binding
 * a module needs (Inventory, Notifications, ...) is declared next to the consumer that owns it
 * via `@RabbitSubscribe`, and golevelup's discovery service wires it up on boot.
 */
@Global()
@Module({
  imports: [
    GolevelupRabbitMQModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('RABBITMQ_URL', 'amqp://localhost:5672'),
        exchanges: [{ name: DOMAIN_EVENTS_EXCHANGE, type: 'topic' }],
        connectionInitOptions: { wait: true, timeout: 20_000 },
        enableControllerDiscovery: true,
      }),
    }),
  ],
  providers: [EventBus],
  exports: [EventBus, GolevelupRabbitMQModule],
})
export class RabbitmqModule {}
