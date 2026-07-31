import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { consumeWithRetry } from '../common/rabbitmq/consume-with-retry';
import { RabbitmqService } from '../common/rabbitmq/rabbitmq.service';
import { ANALYTICS_QUEUE } from '../common/rabbitmq/topology';
import { RideCompletedEvent } from '../rides/ride-completed.event';
import { sleep } from './sleep';

/**
 * Analytics worker: records the completed sale for reporting/dashboards. Does not touch
 * Postgres in this reference implementation — in a real system this would write to a
 * warehouse/analytics store, which is exactly the kind of slow, non-critical work this
 * pattern exists to keep off the request path.
 */
@Injectable()
export class AnalyticsWorker implements OnModuleInit {
  private readonly logger = new Logger(AnalyticsWorker.name);

  constructor(private readonly rabbitmq: RabbitmqService) {}

  async onModuleInit(): Promise<void> {
    await consumeWithRetry<RideCompletedEvent>(
      this.rabbitmq,
      ANALYTICS_QUEUE,
      (job) => this.handle(job),
      this.logger,
    );
    this.logger.log(`Consuming ${ANALYTICS_QUEUE.name}`);
  }

  private async handle(job: RideCompletedEvent): Promise<void> {
    await sleep(200);
    this.logger.log(`Recorded sale analytics for ride ${job.rideId}: fare $${job.fare}`);
  }
}
