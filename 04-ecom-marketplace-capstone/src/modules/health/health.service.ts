import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { ShardRouterService } from '../../sharding/shard-router.service';

export interface HealthReport {
  status: 'ok' | 'degraded';
  instanceId: string;
  services: Record<string, 'up' | 'down'>;
}

/**
 * Backs `GET /health` - what Nginx/compose healthchecks poll. Checks every
 * piece of infra a request might touch: the primary DB, all three shards
 * (a request that needs a specific user is only ever ONE of these, but the
 * healthcheck itself verifies all three are reachable), Redis, and RabbitMQ.
 */
@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    @InjectDataSource('primary') private readonly primaryDataSource: DataSource,
    private readonly shardRouter: ShardRouterService,
    private readonly redis: RedisService,
    private readonly amqpConnection: AmqpConnection,
  ) {}

  async check(instanceId: string): Promise<HealthReport> {
    const services: Record<string, 'up' | 'down'> = {};

    services['postgres-primary'] = await this.probe(() => this.primaryDataSource.query('SELECT 1'));

    const shardChecks = this.shardRouter.allDataSources.map((ds, index) =>
      this.probe(() => ds.query('SELECT 1')).then((status) => {
        services[`postgres-shard-${index}`] = status;
      }),
    );
    await Promise.all(shardChecks);

    services.redis = await this.probe(() => this.redis.ping());
    services.rabbitmq = this.amqpConnection.connected ? 'up' : 'down';

    const allUp = Object.values(services).every((status) => status === 'up');
    return { status: allUp ? 'ok' : 'degraded', instanceId, services };
  }

  private async probe(fn: () => Promise<unknown>): Promise<'up' | 'down'> {
    try {
      await fn();
      return 'up';
    } catch (error) {
      this.logger.warn(`Health probe failed: ${(error as Error).message}`);
      return 'down';
    }
  }
}
