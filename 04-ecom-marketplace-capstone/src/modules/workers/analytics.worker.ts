import { Injectable, Logger } from '@nestjs/common';
import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import {
  DOMAIN_EVENTS_DLX,
  DOMAIN_EVENTS_EXCHANGE,
  OrderCreatedEvent,
  QUEUES,
  ROUTING_KEYS,
} from '../../infrastructure/rabbitmq/constants';

/** Simulates recording a sale into an analytics pipeline/warehouse. */
@Injectable()
export class AnalyticsWorker {
  private readonly logger = new Logger(AnalyticsWorker.name);

  @RabbitSubscribe({
    exchange: DOMAIN_EVENTS_EXCHANGE,
    routingKey: ROUTING_KEYS.ORDER_CREATED,
    queue: QUEUES.ANALYTICS_ON_ORDER_CREATED,
    queueOptions: {
      durable: true,
      arguments: { 'x-dead-letter-exchange': DOMAIN_EVENTS_DLX },
    },
  })
  async handleOrderCreated(event: OrderCreatedEvent): Promise<void> {
    this.logger.log(
      `[analytics-worker] Recorded sale: order ${event.orderId}, user ${event.userId}, ${event.items.length} line item(s), total ${event.totalCents} cents`,
    );
  }
}
