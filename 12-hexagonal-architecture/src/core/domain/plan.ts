import { UnknownPlanError } from './errors';

export type PlanId = 'basic' | 'pro' | 'enterprise';

export interface Plan {
  readonly id: PlanId;
  readonly name: string;
  /** Monthly price in whole currency units (dollars), not cents. */
  readonly price: number;
}

/** Ordered lowest to highest — index is used to decide "is this an upgrade or a downgrade?". */
const PLAN_ORDER: readonly PlanId[] = ['basic', 'pro', 'enterprise'];

const PLANS: Readonly<Record<PlanId, Plan>> = {
  basic: { id: 'basic', name: 'Basic', price: 9 },
  pro: { id: 'pro', name: 'Pro', price: 29 },
  enterprise: { id: 'enterprise', name: 'Enterprise', price: 99 },
};

export function getPlan(planId: PlanId): Plan {
  const plan = PLANS[planId];
  if (!plan) {
    throw new UnknownPlanError(String(planId));
  }
  return plan;
}

export function planRank(planId: PlanId): number {
  const rank = PLAN_ORDER.indexOf(planId);
  if (rank === -1) {
    throw new UnknownPlanError(String(planId));
  }
  return rank;
}

export function listPlans(): Plan[] {
  return PLAN_ORDER.map((id) => PLANS[id]);
}
