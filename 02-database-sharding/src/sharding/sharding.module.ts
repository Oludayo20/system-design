import { Global, Module } from '@nestjs/common';
import { ShardManagerService } from './shard-manager.service';

/**
 * Global so any feature module can inject ShardManagerService without every
 * module re-importing it - there is exactly one shard topology per process.
 */
@Global()
@Module({
  providers: [ShardManagerService],
  exports: [ShardManagerService],
})
export class ShardingModule {}
