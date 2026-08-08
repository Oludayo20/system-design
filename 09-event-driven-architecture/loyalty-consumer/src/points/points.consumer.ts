import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RabbitmqService } from '../common/rabbitmq/rabbitmq.service';
import { LOYALTY_QUEUE } from '../common/rabbitmq/topology';
import { OrderPlacedEvent } from '../order-placed.event';
import { PointsService } from './points.service';

/**
 * The whole "day 2" integration is this file plus topology.ts's queue binding. Compare this
 * class to stock.consumer.ts / notifications.consumer.ts / stats.consumer.ts in the sibling
 * apps — same shape, same pattern, zero coordination required with order-api or with each other.
 */
@Injectable()
export class PointsConsumer implements OnModuleInit {
  private readonly logger = new Logger(PointsConsumer.name);

  constructor(
    private readonly rabbitmq: RabbitmqService,
    private readonly pointsService: PointsService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.rabbitmq.consume<OrderPlacedEvent>(LOYALTY_QUEUE, (event) =>
      this.pointsService.awardForOrder(event),
    );
    this.logger.log(`Consuming ${LOYALTY_QUEUE}`);
  }
}
