import { Module } from '@nestjs/common';
import { PointsConsumer } from './points.consumer';
import { PointsController } from './points.controller';
import { PointsService } from './points.service';

@Module({
  controllers: [PointsController],
  providers: [PointsService, PointsConsumer],
})
export class PointsModule {}
