import { Subscription } from '../../domain/subscription';

/** DI token the core defines and outbound adapters are bound to — see app.module.ts. */
export const SUBSCRIPTION_REPOSITORY_PORT = Symbol('SUBSCRIPTION_REPOSITORY_PORT');

/**
 * Output port: what the core needs from persistence. It knows nothing about Postgres, TypeORM,
 * or any other storage technology — just this interface. Two adapters implement it:
 * PostgresSubscriptionRepository and InMemorySubscriptionRepository.
 */
export interface SubscriptionRepositoryPort {
  save(subscription: Subscription): Promise<void>;
  findById(id: string): Promise<Subscription | null>;
  findByCustomerId(customerId: string): Promise<Subscription | null>;
}
