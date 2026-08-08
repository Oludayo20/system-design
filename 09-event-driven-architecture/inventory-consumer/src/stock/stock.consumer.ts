import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RabbitmqService } from '../common/rabbitmq/rabbitmq.service';
import { INVENTORY_QUEUE } from '../common/rabbitmq/topology';
import { OrderPlacedEvent } from '../order-placed.event';
import { StockService } from './stock.service';

/**
 * This is the entire integration surface with order-api: subscribe to a queue. There is no
 * import of, call to, or awareness of the OrdersController/OrdersService anywhere in this repo.
 * If FreshCart ships a fifth consumer tomorrow, it looks exactly like this file — order-api's
 * source code does not change by a single line (see loyalty-consumer for that proof in action).
 */
@Injectable()
export class StockConsumer implements OnModuleInit {
  private readonly logger = new Logger(StockConsumer.name);

  constructor(
    private readonly rabbitmq: RabbitmqService,
    private readonly stockService: StockService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.stockService.seedIfEmpty();
    await this.rabbitmq.consume<OrderPlacedEvent>(INVENTORY_QUEUE, (event) =>
      this.stockService.applyOrder(event),
    );
    this.logger.log(`Consuming ${INVENTORY_QUEUE}`);
  }
}
