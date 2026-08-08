/**
 * Zero Postgres. Zero NestJS TestingModule. Zero HTTP. Just the core use case, the real
 * InMemorySubscriptionRepository adapter, and trivial fake payment/notifier doubles — all wired
 * with plain `new`. This is the payoff of hexagonal architecture: the core's business rules are
 * testable in milliseconds, with no infrastructure standing between the test and the rule.
 */
import { InMemorySubscriptionRepository } from '../../adapters/out/persistence/in-memory-subscription.repository';
import { CustomerAlreadySubscribedError, PaymentFailedError } from '../domain/errors';
import {
  AlwaysFailsPaymentGateway,
  AlwaysSucceedsPaymentGateway,
  RecordingNotifier,
} from '../test-support/fakes';
import { SubscribeUseCase } from './subscribe.use-case';

describe('SubscribeUseCase', () => {
  it('creates a new active subscription and charges the plan price', async () => {
    const repository = new InMemorySubscriptionRepository();
    const gateway = new AlwaysSucceedsPaymentGateway();
    const notifier = new RecordingNotifier();
    const useCase = new SubscribeUseCase(repository, gateway, notifier);

    const subscription = await useCase.execute({ customerId: 'cust-1', planId: 'pro' });

    expect(subscription.customerId).toBe('cust-1');
    expect(subscription.planId).toBe('pro');
    expect(subscription.cancelAtPeriodEnd).toBe(false);
    expect(gateway.charges).toEqual([{ amount: 29, customerId: 'cust-1' }]);
    expect(notifier.messages).toHaveLength(1);
    expect(await repository.findById(subscription.id)).not.toBeNull();
  });

  it('rejects subscribing a customer who already has an active subscription (rule 4)', async () => {
    const repository = new InMemorySubscriptionRepository();
    const gateway = new AlwaysSucceedsPaymentGateway();
    const notifier = new RecordingNotifier();
    const useCase = new SubscribeUseCase(repository, gateway, notifier);

    await useCase.execute({ customerId: 'cust-1', planId: 'basic' });

    await expect(useCase.execute({ customerId: 'cust-1', planId: 'pro' })).rejects.toThrow(
      CustomerAlreadySubscribedError,
    );
    // Still only the first subscription — the rejected attempt never touched the repository.
    const stored = await repository.findByCustomerId('cust-1');
    expect(stored?.planId).toBe('basic');
  });

  it('does not create a subscription when the payment gateway declines the charge', async () => {
    const repository = new InMemorySubscriptionRepository();
    const gateway = new AlwaysFailsPaymentGateway();
    const notifier = new RecordingNotifier();
    const useCase = new SubscribeUseCase(repository, gateway, notifier);

    await expect(useCase.execute({ customerId: 'cust-2', planId: 'basic' })).rejects.toThrow(
      PaymentFailedError,
    );
    expect(await repository.findByCustomerId('cust-2')).toBeNull();
    expect(notifier.messages).toHaveLength(0);
  });
});
