import { Injectable, Logger } from '@nestjs/common';
import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { CatalogService } from '../catalog/catalog.service';
import {
  DOMAIN_EVENTS_EXCHANGE,
  EventEnvelope,
  RoutingKeys,
} from '../../infrastructure/rabbitmq/rabbitmq.constants';
import { OrderCreatedEvent } from '../ordering/events/order-created.event';

/**
 * The Inventory "module": no controller, no HTTP surface — just a durable queue bound to
 * `order.created`. Still the same process, same deployment, but decoupled from Ordering:
 * Ordering has no idea Inventory exists, it only knows it published an event.
 */
@Injectable()
export class InventoryConsumer {
  private readonly logger = new Logger(InventoryConsumer.name);

  constructor(private readonly catalogService: CatalogService) {}

  @RabbitSubscribe({
    exchange: DOMAIN_EVENTS_EXCHANGE,
    routingKey: RoutingKeys.ORDER_CREATED,
    queue: 'inventory.order_created',
    queueOptions: { durable: true },
  })
  async handleOrderCreated(envelope: EventEnvelope<OrderCreatedEvent>): Promise<void> {
    const { orderId, items } = envelope.payload;
    this.logger.log(`Reducing stock for order ${orderId} (${items.length} line item(s))`);

    for (const item of items) {
      await this.catalogService.decrementStock(item.productId, item.quantity);
    }

    this.logger.log(`Stock reduction complete for order ${orderId}`);
  }
}
