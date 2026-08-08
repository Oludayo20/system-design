import { Subscription } from '../../domain/subscription';

export interface GetSubscriptionQuery {
  subscriptionId: string;
}

/** Input port: read a single subscription by id. Backs `GET /subscriptions/:id`. */
export interface GetSubscriptionPort {
  execute(query: GetSubscriptionQuery): Promise<Subscription>;
}
