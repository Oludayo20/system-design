import { PlanId } from '../../domain/plan';
import { Subscription } from '../../domain/subscription';

export interface ChangePlanCommand {
  subscriptionId: string;
  newPlanId: PlanId;
}

export interface ChangePlanResult {
  subscription: Subscription;
  /** Amount charged immediately for the prorated upgrade (0 is never returned — downgrades throw). */
  proratedAmount: number;
}

/** Input port: upgrade or attempt-to-downgrade an existing subscription's plan. */
export interface ChangePlanPort {
  execute(command: ChangePlanCommand): Promise<ChangePlanResult>;
}
