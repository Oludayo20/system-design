import { Injectable, Logger } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { DOMAIN_EVENTS_EXCHANGE } from './constants';

/**
 * The only thing OrderService (and any future publisher) depends on. Kept
 * as a narrow interface-shaped class rather than injecting AmqpConnection
 * directly everywhere, so unit tests can mock `publish` without dragging in
 * a real AMQP connection - this is what makes the "persist-then-publish,
 * without awaiting downstream workers" unit test possible without Docker.
 */
@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);

  constructor(private readonly amqpConnection: AmqpConnection) {}

  async publish(routingKey: string, payload: Record<string, unknown>): Promise<void> {
    this.logger.log(`Publishing ${routingKey} -> ${DOMAIN_EVENTS_EXCHANGE}`);
    await this.amqpConnection.publish(DOMAIN_EVENTS_EXCHANGE, routingKey, payload);
  }
}
