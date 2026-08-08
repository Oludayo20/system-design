import { Subscription } from '../../domain/subscription';

export interface CancelCommand {
  subscriptionId: string;
}

/** Input port: schedule a subscription to cancel at the end of its current billing period. */
export interface CancelPort {
  execute(command: CancelCommand): Promise<Subscription>;
}
