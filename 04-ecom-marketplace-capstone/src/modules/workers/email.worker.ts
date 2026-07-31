import { Injectable, Logger } from '@nestjs/common';
import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import {
  DOMAIN_EVENTS_DLX,
  DOMAIN_EVENTS_EXCHANGE,
  OrderCreatedEvent,
  QUEUES,
  ROUTING_KEYS,
} from '../../infrastructure/rabbitmq/constants';

/**
 * Simulates the doc's "Send Receipt" step - the 5-second slow task the
 * whole point of this architecture is to keep off the request/response
 * path. In production this would call a real email provider (SES,
 * Postmark, etc); here it logs, which is enough to observe in
 * `docker compose logs -f` that it ran independently of the API response.
 */
@Injectable()
export class EmailWorker {
  private readonly logger = new Logger(EmailWorker.name);

  @RabbitSubscribe({
    exchange: DOMAIN_EVENTS_EXCHANGE,
    routingKey: ROUTING_KEYS.ORDER_CREATED,
    queue: QUEUES.EMAIL_ON_ORDER_CREATED,
    queueOptions: {
      durable: true,
      arguments: { 'x-dead-letter-exchange': DOMAIN_EVENTS_DLX },
    },
  })
  async handleOrderCreated(event: OrderCreatedEvent): Promise<void> {
    this.logger.log(
      `[email-worker] Sending receipt for order ${event.orderId} to user ${event.userId} (total: ${event.totalCents} cents)`,
    );
  }
}
