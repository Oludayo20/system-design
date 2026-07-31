import { Injectable, Logger } from '@nestjs/common';
import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import {
  DOMAIN_EVENTS_DLX,
  DOMAIN_EVENTS_EXCHANGE,
  OrderCreatedEvent,
  QUEUES,
  ROUTING_KEYS,
} from '../../infrastructure/rabbitmq/constants';
import { MarketplaceService } from '../marketplace/marketplace.service';

/**
 * Reduces stock via MarketplaceService.decrementStock - the same narrow,
 * module-boundary-respecting method OrdersService would use if it ever
 * needed to touch stock (it doesn't; that's this worker's job). Nothing
 * imports Product's Repository directly outside the Marketplace module.
 */
@Injectable()
export class InventoryWorker {
  private readonly logger = new Logger(InventoryWorker.name);

  constructor(private readonly marketplaceService: MarketplaceService) {}

  @RabbitSubscribe({
    exchange: DOMAIN_EVENTS_EXCHANGE,
    routingKey: ROUTING_KEYS.ORDER_CREATED,
    queue: QUEUES.INVENTORY_ON_ORDER_CREATED,
    queueOptions: {
      durable: true,
      arguments: { 'x-dead-letter-exchange': DOMAIN_EVENTS_DLX },
    },
  })
  async handleOrderCreated(event: OrderCreatedEvent): Promise<void> {
    for (const item of event.items) {
      this.logger.log(
        `[inventory-worker] Order ${event.orderId}: decrementing stock for product ${item.productId} by ${item.quantity}`,
      );
      await this.marketplaceService.decrementStock(item.productId, item.quantity);
    }
  }
}
