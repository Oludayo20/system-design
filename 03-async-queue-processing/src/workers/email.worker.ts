import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { consumeWithRetry } from '../common/rabbitmq/consume-with-retry';
import { RabbitmqService } from '../common/rabbitmq/rabbitmq.service';
import { EMAIL_QUEUE } from '../common/rabbitmq/topology';
import { RideCompletedEvent } from '../rides/ride-completed.event';
import { sleep } from './sleep';

/**
 * Receipt/Email worker from the doc's Uber example. Simulates ~3s of real work (PDF + email
 * send), scaled down here so the demo isn't slow to watch. EMAIL_FAILURE_RATE deliberately
 * fails a configurable fraction of jobs so the retry -> DLQ path is observable without having
 * to manually break anything.
 */
@Injectable()
export class EmailWorker implements OnModuleInit {
  private readonly logger = new Logger(EmailWorker.name);
  private readonly failureRate: number;

  constructor(
    private readonly rabbitmq: RabbitmqService,
    config: ConfigService,
  ) {
    this.failureRate = config.get<number>('email.failureRate') ?? 0.3;
  }

  async onModuleInit(): Promise<void> {
    await consumeWithRetry<RideCompletedEvent>(
      this.rabbitmq,
      EMAIL_QUEUE,
      (job) => this.handle(job),
      this.logger,
    );
    this.logger.log(`Consuming ${EMAIL_QUEUE.name} (simulated failure rate: ${this.failureRate})`);
  }

  private async handle(job: RideCompletedEvent): Promise<void> {
    await sleep(600);

    if (Math.random() < this.failureRate) {
      throw new Error(`Simulated email provider outage while emailing rider ${job.riderId}`);
    }

    this.logger.log(
      `Receipt emailed to rider ${job.riderId} for ride ${job.rideId} (fare $${job.fare}, ${job.pickupLocation} -> ${job.dropoffLocation})`,
    );
  }
}
