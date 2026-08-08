import { Module } from '@nestjs/common';
import { StatsConsumer } from './stats.consumer';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

@Module({
  controllers: [StatsController],
  providers: [StatsService, StatsConsumer],
})
export class StatsModule {}
