import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityTarget, Repository } from 'typeorm';
import { HashShardingStrategy } from './strategies/hash-sharding.strategy';
import { SHARD_COUNT } from '../config/configuration';

/**
 * Single choke point for "which physical database owns this user?".
 *
 * Every module that touches User or Wallet data goes through this service
 * instead of injecting a shard DataSource directly. That keeps the shard
 * key (hash(userId) % SHARD_COUNT) defined in exactly one place, and keeps
 * every query in the app single-shard - nothing here ever scatter-gathers
 * across all three shards, which is deliberate: the whole point of sharding
 * by userId is that a request for one user only ever needs one connection.
 */
@Injectable()
export class ShardRouterService {
  private readonly strategy: HashShardingStrategy;
  private readonly dataSources: DataSource[];

  constructor(
    @Inject(SHARD_COUNT) shardCount: number,
    @InjectDataSource('shard0') shard0: DataSource,
    @InjectDataSource('shard1') shard1: DataSource,
    @InjectDataSource('shard2') shard2: DataSource,
  ) {
    this.strategy = new HashShardingStrategy(shardCount);
    this.dataSources = [shard0, shard1, shard2];
  }

  resolveShardIndex(userId: string): number {
    return this.strategy.resolveShard(userId);
  }

  getDataSource(shardIndex: number): DataSource {
    const ds = this.dataSources[shardIndex];
    if (!ds) {
      throw new Error(`No DataSource registered for shard index ${shardIndex}`);
    }
    return ds;
  }

  getDataSourceForUser(userId: string): DataSource {
    return this.getDataSource(this.resolveShardIndex(userId));
  }

  getRepository<Entity extends object>(
    entity: EntityTarget<Entity>,
    userId: string,
  ): Repository<Entity> {
    return this.getDataSourceForUser(userId).getRepository(entity);
  }

  get allDataSources(): DataSource[] {
    return this.dataSources;
  }
}
