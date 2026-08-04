import { Module } from '@nestjs/common';
import { CapController } from './cap.controller';
import { ClusterService } from '../cluster/cluster.service';

@Module({
  controllers: [CapController],
  providers: [ClusterService],
})
export class CapModule {}
