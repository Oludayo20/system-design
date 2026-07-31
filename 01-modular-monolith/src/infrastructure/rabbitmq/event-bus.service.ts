import { Injectable, Logger } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { DOMAIN_EVENTS_EXCHANGE, EventEnvelope, RoutingKey } from './rabbitmq.constants';

/**
 * The only way modules are allowed to talk to RabbitMQ. Publishing goes through here so every
 * event gets the same envelope shape and the same log line, and so no module needs to know the
 * exchange name or the underlying amqp client.
 */
@Injectable()
export class EventBus {
  private readonly logger = new Logger(EventBus.name);

  constructor(private readonly amqpConnection: AmqpConnection) {}

  async publish<T extends object>(routingKey: RoutingKey, payload: T): Promise<void> {
    const envelope: EventEnvelope<T> = {
      event: routingKey,
      timestamp: new Date().toISOString(),
      payload,
    };

    this.logger.log(`Publishing "${routingKey}" -> ${DOMAIN_EVENTS_EXCHANGE}`);
    await this.amqpConnection.publish(DOMAIN_EVENTS_EXCHANGE, routingKey, envelope);
  }
}
