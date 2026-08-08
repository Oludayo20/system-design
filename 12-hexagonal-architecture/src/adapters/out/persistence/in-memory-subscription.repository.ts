import { Injectable } from '@nestjs/common';
import { Subscription } from '../../../core/domain/subscription';
import { SubscriptionRepositoryPort } from '../../../core/ports/out/subscription-repository.port';

/**
 * Outbound/driven adapter #1 for SubscriptionRepositoryPort — an in-memory store. Implements the
 * exact same port as PostgresSubscriptionRepository, with no database at all. Selected via
 * `REPOSITORY=memory`, and reused directly (via `new`, no NestJS) by the core's unit tests.
 */
@Injectable()
export class InMemorySubscriptionRepository implements SubscriptionRepositoryPort {
  private readonly byId = new Map<string, Subscription>();

  async save(subscription: Subscription): Promise<void> {
    this.byId.set(subscription.id, subscription);
  }

  async findById(id: string): Promise<Subscription | null> {
    return this.byId.get(id) ?? null;
  }

  async findByCustomerId(customerId: string): Promise<Subscription | null> {
    let latest: Subscription | null = null;
    for (const subscription of this.byId.values()) {
      if (subscription.customerId !== customerId) continue;
      if (!latest || subscription.createdAt.getTime() > latest.createdAt.getTime()) {
        latest = subscription;
      }
    }
    return latest;
  }
}
