import { PlanId } from '../../domain/plan';
import { Subscription } from '../../domain/subscription';

export interface SubscribeCommand {
  customerId: string;
  planId: PlanId;
}

/**
 * Input port: what the core exposes to drive a new subscription. Inbound/driving adapters
 * (the REST controller, the CLI) call INTO the core through this interface.
 */
export interface SubscribePort {
  execute(command: SubscribeCommand): Promise<Subscription>;
}
