import { SubscriptionNotFoundError } from '../domain/errors';
import { Subscription } from '../domain/subscription';
import { CancelCommand, CancelPort } from '../ports/in/cancel.port';
import { NotifierPort } from '../ports/out/notifier.port';
import { SubscriptionRepositoryPort } from '../ports/out/subscription-repository.port';

/** Implements CancelPort. The "stays active until period end" rule lives on Subscription.cancel(). */
export class CancelUseCase implements CancelPort {
  constructor(
    private readonly subscriptionRepository: SubscriptionRepositoryPort,
    private readonly notifier: NotifierPort,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async execute(command: CancelCommand): Promise<Subscription> {
    const now = this.clock();

    const subscription = await this.subscriptionRepository.findById(command.subscriptionId);
    if (!subscription) {
      throw new SubscriptionNotFoundError(command.subscriptionId);
    }

    subscription.cancel(now);
    await this.subscriptionRepository.save(subscription);
    await this.notifier.notify(
      subscription.customerId,
      `Subscription will cancel at period end (${subscription.currentPeriodEnd.toISOString()}). Access continues until then.`,
    );

    return subscription;
  }
}
