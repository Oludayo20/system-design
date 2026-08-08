import { computeProration, startNewBillingPeriod } from './billing-cycle';
import {
  AlreadyCanceledError,
  DowngradeNotAllowedMidCycleError,
  SamePlanError,
  SubscriptionNotActiveError,
} from './errors';
import { getPlan, PlanId, planRank } from './plan';

export interface SubscriptionProps {
  id: string;
  customerId: string;
  planId: PlanId;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlanChangePreview {
  proratedAmount: number;
}

/**
 * The Orbit subscription aggregate. This is the entire business-rule surface of the domain —
 * a plain TypeScript class with no decorators, no ORM, no HTTP. Everything it needs from the
 * outside world (persistence, payments, notifications) is a parameter, never an import.
 */
export class Subscription {
  readonly id: string;
  readonly customerId: string;
  planId: PlanId;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  readonly createdAt: Date;
  updatedAt: Date;

  private constructor(props: SubscriptionProps) {
    this.id = props.id;
    this.customerId = props.customerId;
    this.planId = props.planId;
    this.currentPeriodStart = props.currentPeriodStart;
    this.currentPeriodEnd = props.currentPeriodEnd;
    this.cancelAtPeriodEnd = props.cancelAtPeriodEnd;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  /** Starts a brand-new subscription, beginning a fresh billing period at `now`. */
  static create(params: {
    id: string;
    customerId: string;
    planId: PlanId;
    now: Date;
  }): Subscription {
    getPlan(params.planId); // throws UnknownPlanError for an invalid plan id
    const { currentPeriodStart, currentPeriodEnd } = startNewBillingPeriod(params.now);
    return new Subscription({
      id: params.id,
      customerId: params.customerId,
      planId: params.planId,
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd: false,
      createdAt: params.now,
      updatedAt: params.now,
    });
  }

  /** Re-hydrates a subscription from persisted state. No business rules run here. */
  static restore(props: SubscriptionProps): Subscription {
    return new Subscription(props);
  }

  /** True while the current billing period hasn't ended yet — cancellation-pending or not. */
  isActive(now: Date): boolean {
    return now.getTime() < this.currentPeriodEnd.getTime();
  }

  /**
   * Business rule 1: downgrading mid-cycle is rejected until `currentPeriodEnd`.
   * Business rule 2: upgrading mid-cycle is allowed and requires an immediate prorated charge.
   *
   * This method only *previews* the change — it validates the rules and computes the amount to
   * charge, but does not mutate state. That lets a use case charge the payment gateway first and
   * only call applyPlanChange() once the charge succeeds, so a declined payment never leaves the
   * subscription half-upgraded.
   */
  previewPlanChange(newPlanId: PlanId, now: Date): PlanChangePreview {
    if (!this.isActive(now)) {
      throw new SubscriptionNotActiveError(this.id);
    }

    const currentRank = planRank(this.planId);
    const newRank = planRank(newPlanId);

    if (newRank === currentRank) {
      throw new SamePlanError(this.id, newPlanId);
    }
    if (newRank < currentRank) {
      throw new DowngradeNotAllowedMidCycleError(this.id, this.currentPeriodEnd);
    }

    const proratedAmount = computeProration({
      oldPrice: getPlan(this.planId).price,
      newPrice: getPlan(newPlanId).price,
      now,
      currentPeriodStart: this.currentPeriodStart,
      currentPeriodEnd: this.currentPeriodEnd,
    });

    return { proratedAmount };
  }

  /** Applies an upgrade already validated (and paid for) via previewPlanChange(). */
  applyPlanChange(newPlanId: PlanId, now: Date): void {
    this.planId = newPlanId;
    this.updatedAt = now;
  }

  /**
   * Business rule 3: cancelling schedules cancellation at period end rather than deleting or
   * deactivating anything immediately — the subscription stays active until currentPeriodEnd.
   */
  cancel(now: Date): void {
    if (!this.isActive(now)) {
      throw new SubscriptionNotActiveError(this.id);
    }
    if (this.cancelAtPeriodEnd) {
      throw new AlreadyCanceledError(this.id);
    }
    this.cancelAtPeriodEnd = true;
    this.updatedAt = now;
  }
}
