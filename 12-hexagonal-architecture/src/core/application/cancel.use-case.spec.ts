/** Zero Postgres. Zero NestJS TestingModule. Zero HTTP. See subscribe.use-case.spec.ts for why. */
import { InMemorySubscriptionRepository } from '../../adapters/out/persistence/in-memory-subscription.repository';
import { AlreadyCanceledError } from '../domain/errors';
import { Subscription } from '../domain/subscription';
import { RecordingNotifier } from '../test-support/fakes';
import { CancelUseCase } from './cancel.use-case';

const PERIOD_START = new Date('2026-01-01T00:00:00.000Z');
const PERIOD_END = new Date('2026-01-31T00:00:00.000Z');
const NOW = new Date('2026-01-16T00:00:00.000Z'); // mid-cycle

async function seedSubscription(repository: InMemorySubscriptionRepository): Promise<void> {
  await repository.save(
    Subscription.restore({
      id: 'sub-1',
      customerId: 'cust-1',
      planId: 'pro',
      currentPeriodStart: PERIOD_START,
      currentPeriodEnd: PERIOD_END,
      cancelAtPeriodEnd: false,
      createdAt: PERIOD_START,
      updatedAt: PERIOD_START,
    }),
  );
}

describe('CancelUseCase', () => {
  it('sets cancelAtPeriodEnd without deactivating the subscription immediately (rule 3)', async () => {
    const repository = new InMemorySubscriptionRepository();
    await seedSubscription(repository);
    const notifier = new RecordingNotifier();
    const useCase = new CancelUseCase(repository, notifier, () => NOW);

    const result = await useCase.execute({ subscriptionId: 'sub-1' });

    expect(result.cancelAtPeriodEnd).toBe(true);
    expect(result.currentPeriodEnd).toEqual(PERIOD_END); // untouched — nothing deleted
    expect(result.isActive(NOW)).toBe(true); // still active until period end
    expect(notifier.messages).toHaveLength(1);

    const persisted = await repository.findById('sub-1');
    expect(persisted?.cancelAtPeriodEnd).toBe(true);
  });

  it('rejects cancelling a subscription that is already scheduled to cancel', async () => {
    const repository = new InMemorySubscriptionRepository();
    await seedSubscription(repository);
    const notifier = new RecordingNotifier();
    const useCase = new CancelUseCase(repository, notifier, () => NOW);

    await useCase.execute({ subscriptionId: 'sub-1' });

    await expect(useCase.execute({ subscriptionId: 'sub-1' })).rejects.toThrow(
      AlreadyCanceledError,
    );
  });
});
