import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlanId } from '../../../core/domain/plan';
import { Subscription } from '../../../core/domain/subscription';
import { SubscriptionRepositoryPort } from '../../../core/ports/out/subscription-repository.port';
import { SubscriptionOrmEntity } from './subscription.orm-entity';

/**
 * Outbound/driven adapter #2 for SubscriptionRepositoryPort — real Postgres via TypeORM.
 * Implements the exact same port as InMemorySubscriptionRepository. Selected via
 * `REPOSITORY=postgres`. The core never sees `SubscriptionOrmEntity` or a TypeORM `Repository`.
 */
@Injectable()
export class PostgresSubscriptionRepository implements SubscriptionRepositoryPort {
  constructor(
    @InjectRepository(SubscriptionOrmEntity)
    private readonly repository: Repository<SubscriptionOrmEntity>,
  ) {}

  async save(subscription: Subscription): Promise<void> {
    await this.repository.save(this.toOrmEntity(subscription));
  }

  async findById(id: string): Promise<Subscription | null> {
    const row = await this.repository.findOne({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findByCustomerId(customerId: string): Promise<Subscription | null> {
    const row = await this.repository.findOne({
      where: { customerId },
      order: { createdAt: 'DESC' },
    });
    return row ? this.toDomain(row) : null;
  }

  private toOrmEntity(subscription: Subscription): SubscriptionOrmEntity {
    const entity = new SubscriptionOrmEntity();
    entity.id = subscription.id;
    entity.customerId = subscription.customerId;
    entity.planId = subscription.planId;
    entity.currentPeriodStart = subscription.currentPeriodStart;
    entity.currentPeriodEnd = subscription.currentPeriodEnd;
    entity.cancelAtPeriodEnd = subscription.cancelAtPeriodEnd;
    entity.createdAt = subscription.createdAt;
    entity.updatedAt = subscription.updatedAt;
    return entity;
  }

  private toDomain(row: SubscriptionOrmEntity): Subscription {
    return Subscription.restore({
      id: row.id,
      customerId: row.customerId,
      planId: row.planId as PlanId,
      currentPeriodStart: row.currentPeriodStart,
      currentPeriodEnd: row.currentPeriodEnd,
      cancelAtPeriodEnd: row.cancelAtPeriodEnd,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
