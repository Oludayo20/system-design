import { Injectable, Logger } from '@nestjs/common';
import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import {
  DOMAIN_EVENTS_EXCHANGE,
  EventEnvelope,
  RoutingKeys,
} from '../../infrastructure/rabbitmq/rabbitmq.constants';
import { OrderCreatedEvent } from '../ordering/events/order-created.event';

const SIMULATED_EMAIL_SEND_MS = 5_000;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The Notifications "module": simulates the slow part of the request (sending an email receipt)
 * entirely outside the HTTP request/response cycle. `POST /orders` already returned
 * `{ success: true }` to the customer well before this handler even starts running.
 */
@Injectable()
export class NotificationsConsumer {
  private readonly logger = new Logger(NotificationsConsumer.name);

  @RabbitSubscribe({
    exchange: DOMAIN_EVENTS_EXCHANGE,
    routingKey: RoutingKeys.ORDER_CREATED,
    queue: 'notifications.order_created',
    queueOptions: { durable: true },
  })
  async handleOrderCreated(envelope: EventEnvelope<OrderCreatedEvent>): Promise<void> {
    const { orderId, userId, total } = envelope.payload;
    this.logger.log(
      `Sending receipt email for order ${orderId} to user ${userId} (simulated, ~5s)...`,
    );

    await delay(SIMULATED_EMAIL_SEND_MS);

    this.logger.log(`Receipt email sent for order ${orderId}, total $${total.toFixed(2)}`);
  }
}
