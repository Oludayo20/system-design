import { randomUUID } from 'crypto';
import { CustomerAlreadySubscribedError, PaymentFailedError } from '../domain/errors';
import { getPlan } from '../domain/plan';
import { Subscription } from '../domain/subscription';
import { SubscribeCommand, SubscribePort } from '../ports/in/subscribe.port';
import { NotifierPort } from '../ports/out/notifier.port';
import { PaymentGatewayPort } from '../ports/out/payment-gateway.port';
import { SubscriptionRepositoryPort } from '../ports/out/subscription-repository.port';

/**
 * Implements the SubscribePort by orchestrating the output ports (repository, payment gateway,
 * notifier). This is the ONLY place those three interfaces meet — the use case doesn't know or
 * care whether the repository is Postgres or in-memory, or whether the gateway is Stripe or
 * Flutterwave. That wiring happens in app.module.ts (HTTP) or orbit-cli.ts (CLI).
 */
export class SubscribeUseCase implements SubscribePort {
  constructor(
    private readonly subscriptionRepository: SubscriptionRepositoryPort,
    private readonly paymentGateway: PaymentGatewayPort,
    private readonly notifier: NotifierPort,
    private readonly idGenerator: () => string = randomUUID,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async execute(command: SubscribeCommand): Promise<Subscription> {
    const now = this.clock();

    // Business rule 4: a customer cannot have two active subscriptions at once.
    const existing = await this.subscriptionRepository.findByCustomerId(command.customerId);
    if (existing && existing.isActive(now)) {
      throw new CustomerAlreadySubscribedError(command.customerId);
    }

    const plan = getPlan(command.planId);
    const charge = await this.paymentGateway.charge(plan.price, command.customerId);
    if (!charge.success) {
      throw new PaymentFailedError(
        `initial charge for customer ${command.customerId} was declined`,
      );
    }

    const subscription = Subscription.create({
      id: this.idGenerator(),
      customerId: command.customerId,
      planId: command.planId,
      now,
    });

    await this.subscriptionRepository.save(subscription);
    await this.notifier.notify(
      command.customerId,
      `Subscribed to ${plan.name} ($${plan.price}/mo). Payment ref ${charge.reference}.`,
    );

    return subscription;
  }
}
