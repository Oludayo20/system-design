import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { ShardingModule } from '../../sharding/sharding.module';

@Module({
  imports: [ShardingModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
