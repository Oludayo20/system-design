import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ShardRouterService } from './shard-router.service';
import { SHARD_COUNT } from '../config/configuration';

// ConfigModule itself is registered as @Global (isGlobal: true) in
// AppModule, so ConfigService is injectable here without a local import -
// but SHARD_COUNT must still be provided in THIS module (or a module
// ShardingModule imports) for @Inject(SHARD_COUNT) in ShardRouterService to
// resolve: Nest provider scoping does not reach into a sibling module's
// `providers` array just because both are imported by the same root module.
@Module({
  providers: [
    {
      provide: SHARD_COUNT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => config.get<number>('shardCount'),
    },
    ShardRouterService,
  ],
  exports: [ShardRouterService],
})
export class ShardingModule {}
