import { SubscriptionNotFoundError } from '../domain/errors';
import { Subscription } from '../domain/subscription';
import { GetSubscriptionPort, GetSubscriptionQuery } from '../ports/in/get-subscription.port';
import { SubscriptionRepositoryPort } from '../ports/out/subscription-repository.port';

/** Implements GetSubscriptionPort. A read-only use case backing `GET /subscriptions/:id`. */
export class GetSubscriptionUseCase implements GetSubscriptionPort {
  constructor(private readonly subscriptionRepository: SubscriptionRepositoryPort) {}

  async execute(query: GetSubscriptionQuery): Promise<Subscription> {
    const subscription = await this.subscriptionRepository.findById(query.subscriptionId);
    if (!subscription) {
      throw new SubscriptionNotFoundError(query.subscriptionId);
    }
    return subscription;
  }
}
