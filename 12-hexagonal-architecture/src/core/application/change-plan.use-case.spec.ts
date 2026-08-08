/** Zero Postgres. Zero NestJS TestingModule. Zero HTTP. See subscribe.use-case.spec.ts for why. */
import { InMemorySubscriptionRepository } from '../../adapters/out/persistence/in-memory-subscription.repository';
import { DowngradeNotAllowedMidCycleError, PaymentFailedError } from '../domain/errors';
import { PlanId } from '../domain/plan';
import { Subscription } from '../domain/subscription';
import {
  AlwaysFailsPaymentGateway,
  AlwaysSucceedsPaymentGateway,
  RecordingNotifier,
} from '../test-support/fakes';
import { ChangePlanUseCase } from './change-plan.use-case';

// Fixed, known dates make the proration math exactly checkable against the README's formula:
// (newPrice - oldPrice) * daysRemaining / daysInPeriod.
const PERIOD_START = new Date('2026-01-01T00:00:00.000Z');
const PERIOD_END = new Date('2026-01-31T00:00:00.000Z'); // 30-day period
const NOW = new Date('2026-01-16T00:00:00.000Z'); // exactly 15 days remaining

async function seedSubscription(
  repository: InMemorySubscriptionRepository,
  planId: PlanId,
): Promise<Subscription> {
  const subscription = Subscription.restore({
    id: 'sub-1',
    customerId: 'cust-1',
    planId,
    currentPeriodStart: PERIOD_START,
    currentPeriodEnd: PERIOD_END,
    cancelAtPeriodEnd: false,
    createdAt: PERIOD_START,
    updatedAt: PERIOD_START,
  });
  await repository.save(subscription);
  return subscription;
}

describe('ChangePlanUseCase', () => {
  it('upgrade: charges the exact prorated amount and applies the new plan (rule 2)', async () => {
    const repository = new InMemorySubscriptionRepository();
    await seedSubscription(repository, 'basic'); // $9/mo
    const gateway = new AlwaysSucceedsPaymentGateway();
    const notifier = new RecordingNotifier();
    const useCase = new ChangePlanUseCase(repository, gateway, notifier, () => NOW);

    const result = await useCase.execute({ subscriptionId: 'sub-1', newPlanId: 'pro' }); // $29/mo

    // (29 - 9) * 15 / 30 = 10.00 — matches the formula in the README exactly.
    expect(result.proratedAmount).toBe(10);
    expect(result.subscription.planId).toBe('pro');
    expect(gateway.charges).toEqual([{ amount: 10, customerId: 'cust-1' }]);

    const persisted = await repository.findById('sub-1');
    expect(persisted?.planId).toBe('pro');
  });

  it('downgrade: rejected mid-cycle, with no charge and no state change (rule 1)', async () => {
    const repository = new InMemorySubscriptionRepository();
    await seedSubscription(repository, 'enterprise');
    const gateway = new AlwaysSucceedsPaymentGateway();
    const notifier = new RecordingNotifier();
    const useCase = new ChangePlanUseCase(repository, gateway, notifier, () => NOW);

    await expect(useCase.execute({ subscriptionId: 'sub-1', newPlanId: 'pro' })).rejects.toThrow(
      DowngradeNotAllowedMidCycleError,
    );

    expect(gateway.charges).toHaveLength(0);
    expect(notifier.messages).toHaveLength(0);
    const persisted = await repository.findById('sub-1');
    expect(persisted?.planId).toBe('enterprise'); // unchanged
  });

  it('upgrade: leaves the plan unchanged when the proration charge is declined', async () => {
    const repository = new InMemorySubscriptionRepository();
    await seedSubscription(repository, 'basic');
    const gateway = new AlwaysFailsPaymentGateway();
    const notifier = new RecordingNotifier();
    const useCase = new ChangePlanUseCase(repository, gateway, notifier, () => NOW);

    await expect(useCase.execute({ subscriptionId: 'sub-1', newPlanId: 'pro' })).rejects.toThrow(
      PaymentFailedError,
    );

    const persisted = await repository.findById('sub-1');
    expect(persisted?.planId).toBe('basic'); // charge declined -> plan never changed
  });
});
