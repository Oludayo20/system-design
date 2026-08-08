import { PaymentFailedError, SubscriptionNotFoundError } from '../domain/errors';
import { ChangePlanCommand, ChangePlanPort, ChangePlanResult } from '../ports/in/change-plan.port';
import { NotifierPort } from '../ports/out/notifier.port';
import { PaymentGatewayPort } from '../ports/out/payment-gateway.port';
import { SubscriptionRepositoryPort } from '../ports/out/subscription-repository.port';

/**
 * Implements ChangePlanPort. All the actual business rules (downgrade rejection, proration math)
 * live on the Subscription entity itself (subscription.previewPlanChange) — this use case only
 * orchestrates: load, preview, charge if needed, apply, persist, notify.
 */
export class ChangePlanUseCase implements ChangePlanPort {
  constructor(
    private readonly subscriptionRepository: SubscriptionRepositoryPort,
    private readonly paymentGateway: PaymentGatewayPort,
    private readonly notifier: NotifierPort,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async execute(command: ChangePlanCommand): Promise<ChangePlanResult> {
    const now = this.clock();

    const subscription = await this.subscriptionRepository.findById(command.subscriptionId);
    if (!subscription) {
      throw new SubscriptionNotFoundError(command.subscriptionId);
    }

    // Throws DowngradeNotAllowedMidCycleError / SamePlanError without touching state or money.
    const { proratedAmount } = subscription.previewPlanChange(command.newPlanId, now);

    // Upgrades always have a positive proration (newPrice > oldPrice), so this always runs for
    // a successful upgrade — downgrades never reach here, previewPlanChange already threw.
    if (proratedAmount > 0) {
      const charge = await this.paymentGateway.charge(proratedAmount, subscription.customerId);
      if (!charge.success) {
        throw new PaymentFailedError(
          `prorated charge of $${proratedAmount.toFixed(2)} for subscription ${subscription.id} was declined`,
        );
      }
    }

    subscription.applyPlanChange(command.newPlanId, now);
    await this.subscriptionRepository.save(subscription);
    await this.notifier.notify(
      subscription.customerId,
      `Plan changed to ${command.newPlanId}. Prorated charge: $${proratedAmount.toFixed(2)}.`,
    );

    return { subscription, proratedAmount };
  }
}
