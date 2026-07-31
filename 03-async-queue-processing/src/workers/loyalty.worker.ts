import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { consumeWithRetry } from '../common/rabbitmq/consume-with-retry';
import { RabbitmqService } from '../common/rabbitmq/rabbitmq.service';
import { LOYALTY_QUEUE } from '../common/rabbitmq/topology';
import { RideCompletedEvent } from '../rides/ride-completed.event';
import { sleep } from './sleep';

/** Loyalty worker: awards points for the completed ride. */
@Injectable()
export class LoyaltyWorker implements OnModuleInit {
  private readonly logger = new Logger(LoyaltyWorker.name);

  constructor(private readonly rabbitmq: RabbitmqService) {}

  async onModuleInit(): Promise<void> {
    await consumeWithRetry<RideCompletedEvent>(
      this.rabbitmq,
      LOYALTY_QUEUE,
      (job) => this.handle(job),
      this.logger,
    );
    this.logger.log(`Consuming ${LOYALTY_QUEUE.name}`);
  }

  private async handle(job: RideCompletedEvent): Promise<void> {
    await sleep(150);
    const points = Math.max(1, Math.round(Number(job.fare)));
    this.logger.log(
      `Awarded ${points} loyalty points to rider ${job.riderId} for ride ${job.rideId}`,
    );
  }
}
