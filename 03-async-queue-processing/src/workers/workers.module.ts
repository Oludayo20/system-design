import { Module } from '@nestjs/common';
import { AnalyticsWorker } from './analytics.worker';
import { EmailWorker } from './email.worker';
import { LoyaltyWorker } from './loyalty.worker';

@Module({
  providers: [EmailWorker, AnalyticsWorker, LoyaltyWorker],
})
export class WorkersModule {}
