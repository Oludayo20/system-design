import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RabbitmqService } from '../common/rabbitmq/rabbitmq.service';
import { ANALYTICS_QUEUE } from '../common/rabbitmq/topology';
import { OrderPlacedEvent } from '../order-placed.event';
import { StatsService } from './stats.service';

/** This subscribe call is the entire integration with order-api. No shared code, no imports. */
@Injectable()
export class StatsConsumer implements OnModuleInit {
  private readonly logger = new Logger(StatsConsumer.name);

  constructor(
    private readonly rabbitmq: RabbitmqService,
    private readonly statsService: StatsService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.rabbitmq.consume<OrderPlacedEvent>(ANALYTICS_QUEUE, (event) =>
      this.statsService.recordOrder(event),
    );
    this.logger.log(`Consuming ${ANALYTICS_QUEUE}`);
  }
}
