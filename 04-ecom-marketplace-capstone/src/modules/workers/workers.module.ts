import { Module } from '@nestjs/common';
import { EmailWorker } from './email.worker';
import { InventoryWorker } from './inventory.worker';
import { AnalyticsWorker } from './analytics.worker';
import { MarketplaceModule } from '../marketplace/marketplace.module';

/**
 * These workers are NOT a separate deployable - they are consumers running
 * in-process, in the same Nest app as the HTTP API (bound via
 * @RabbitSubscribe, connected through the same RabbitMQModule as the
 * publisher). Both api-1 and api-2 replicas run every worker; RabbitMQ's
 * competing-consumers pattern on each durable queue makes sure a given
 * message is only processed once even with two replicas both listening.
 */
@Module({
  imports: [MarketplaceModule],
  providers: [EmailWorker, InventoryWorker, AnalyticsWorker],
})
export class WorkersModule {}
