/**
 * Domain errors. Plain Error subclasses — no HTTP status codes, no framework knowledge.
 * Inbound adapters (REST controller, CLI) decide how to present these to their caller;
 * see src/adapters/in/http/domain-error.filter.ts for the REST mapping.
 */
export abstract class DomainError extends Error {
  protected constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class UnknownPlanError extends DomainError {
  constructor(planId: string) {
    super(`Unknown plan "${planId}". Valid plans: basic, pro, enterprise.`, 'UNKNOWN_PLAN');
  }
}

export class SubscriptionNotFoundError extends DomainError {
  constructor(subscriptionId: string) {
    super(`Subscription "${subscriptionId}" was not found.`, 'SUBSCRIPTION_NOT_FOUND');
  }
}

export class CustomerAlreadySubscribedError extends DomainError {
  constructor(customerId: string) {
    super(
      `Customer "${customerId}" already has an active subscription.`,
      'CUSTOMER_ALREADY_SUBSCRIBED',
    );
  }
}

/** Business rule: downgrading mid-cycle is not allowed until the current period ends. */
export class DowngradeNotAllowedMidCycleError extends DomainError {
  constructor(subscriptionId: string, currentPeriodEnd: Date) {
    super(
      `Subscription "${subscriptionId}" cannot downgrade mid-cycle. ` +
        `Downgrades take effect at the end of the current billing period (${currentPeriodEnd.toISOString()}).`,
      'DOWNGRADE_NOT_ALLOWED_MID_CYCLE',
    );
  }
}

export class SamePlanError extends DomainError {
  constructor(subscriptionId: string, planId: string) {
    super(`Subscription "${subscriptionId}" is already on plan "${planId}".`, 'SAME_PLAN');
  }
}

export class SubscriptionNotActiveError extends DomainError {
  constructor(subscriptionId: string) {
    super(
      `Subscription "${subscriptionId}" is not active (its billing period has ended).`,
      'SUBSCRIPTION_NOT_ACTIVE',
    );
  }
}

export class AlreadyCanceledError extends DomainError {
  constructor(subscriptionId: string) {
    super(
      `Subscription "${subscriptionId}" is already scheduled to cancel at period end.`,
      'ALREADY_CANCELED',
    );
  }
}

export class PaymentFailedError extends DomainError {
  constructor(reason: string) {
    super(`Payment failed: ${reason}`, 'PAYMENT_FAILED');
  }
}
