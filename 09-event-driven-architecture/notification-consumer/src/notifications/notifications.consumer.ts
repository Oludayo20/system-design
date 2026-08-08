import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RabbitmqService } from '../common/rabbitmq/rabbitmq.service';
import { NOTIFICATION_QUEUE } from '../common/rabbitmq/topology';
import { OrderPlacedEvent } from '../order-placed.event';
import { NotificationsService } from './notifications.service';

/** This subscribe call is the entire integration with order-api. No shared code, no imports. */
@Injectable()
export class NotificationsConsumer implements OnModuleInit {
  private readonly logger = new Logger(NotificationsConsumer.name);

  constructor(
    private readonly rabbitmq: RabbitmqService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.rabbitmq.consume<OrderPlacedEvent>(NOTIFICATION_QUEUE, (event) =>
      this.notificationsService.sendForOrder(event),
    );
    this.logger.log(`Consuming ${NOTIFICATION_QUEUE}`);
  }
}
