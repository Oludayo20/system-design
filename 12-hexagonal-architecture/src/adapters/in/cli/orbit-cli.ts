import 'reflect-metadata';
import { config } from 'dotenv';
config();

import { DataSource } from 'typeorm';
import { CancelUseCase } from '../../../core/application/cancel.use-case';
import { ChangePlanUseCase } from '../../../core/application/change-plan.use-case';
import { GetSubscriptionUseCase } from '../../../core/application/get-subscription.use-case';
import { SubscribeUseCase } from '../../../core/application/subscribe.use-case';
import { DomainError } from '../../../core/domain/errors';
import { PlanId } from '../../../core/domain/plan';
import { NotifierPort } from '../../../core/ports/out/notifier.port';
import { PaymentGatewayPort } from '../../../core/ports/out/payment-gateway.port';
import { SubscriptionRepositoryPort } from '../../../core/ports/out/subscription-repository.port';
import { ConsoleNotifierAdapter } from '../../out/notification/console-notifier.adapter';
import { FlutterwaveMockAdapter } from '../../out/payment/flutterwave-mock.adapter';
import { StripeMockAdapter } from '../../out/payment/stripe-mock.adapter';
import { InMemorySubscriptionRepository } from '../../out/persistence/in-memory-subscription.repository';
import { PostgresSubscriptionRepository } from '../../out/persistence/postgres-subscription.repository';
import { SubscriptionOrmEntity } from '../../out/persistence/subscription.orm-entity';

/**
 * Inbound/driving adapter #2. Same core, same four use-case classes as the REST controller
 * (src/adapters/in/http/subscription.controller.ts) — only the "who's calling" changes.
 * Run it with: `npm run cli -- <command> [--flag value ...]`
 *
 *   npm run cli -- subscribe --customer c1 --plan pro
 *   npm run cli -- change-plan --id <subscriptionId> --plan enterprise
 *   npm run cli -- cancel --id <subscriptionId>
 *   npm run cli -- get --id <subscriptionId>
 *
 * REPOSITORY=memory (default) gives the CLI its own private, in-process store — good for a
 * quick standalone check, but state doesn't survive past this one process. Set
 * REPOSITORY=postgres (with POSTGRES_HOST etc. pointing at the same database the HTTP API uses,
 * e.g. via `docker compose`'s exposed 5432) to have the CLI read/write the exact same rows the
 * HTTP API does — the strongest proof that both adapters drive identical core logic.
 */

interface ParsedArgs {
  command: string | undefined;
  flags: Record<string, string>;
}

function parseArgs(argv: string[]): ParsedArgs {
  const [command, ...rest] = argv;
  const flags: Record<string, string> = {};
  for (let i = 0; i < rest.length; i += 2) {
    const key = rest[i]?.replace(/^--/, '');
    const value = rest[i + 1];
    if (key && value !== undefined) {
      flags[key] = value;
    }
  }
  return { command, flags };
}

async function buildRepository(): Promise<{
  repository: SubscriptionRepositoryPort;
  close: () => Promise<void>;
}> {
  const kind = (process.env.REPOSITORY ?? 'memory').toLowerCase();

  if (kind === 'postgres') {
    const dataSource = new DataSource({
      type: 'postgres',
      host: process.env.POSTGRES_HOST ?? 'localhost',
      port: Number(process.env.POSTGRES_PORT ?? 5432),
      username: process.env.POSTGRES_USER ?? 'orbit',
      password: process.env.POSTGRES_PASSWORD ?? 'orbit_dev_password',
      database: process.env.POSTGRES_DB ?? 'orbit',
      entities: [SubscriptionOrmEntity],
      synchronize: false,
    });
    await dataSource.initialize();
    const ormRepository = dataSource.getRepository(SubscriptionOrmEntity);
    return {
      repository: new PostgresSubscriptionRepository(ormRepository),
      close: () => dataSource.destroy(),
    };
  }

  return { repository: new InMemorySubscriptionRepository(), close: async () => undefined };
}

function buildPaymentGateway(): PaymentGatewayPort {
  const provider = (process.env.PAYMENT_PROVIDER ?? 'stripe').toLowerCase();
  return provider === 'flutterwave' ? new FlutterwaveMockAdapter() : new StripeMockAdapter();
}

function print(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

async function main(): Promise<void> {
  const { command, flags } = parseArgs(process.argv.slice(2));
  const { repository, close } = await buildRepository();
  const paymentGateway = buildPaymentGateway();
  const notifier: NotifierPort = new ConsoleNotifierAdapter();

  try {
    switch (command) {
      case 'subscribe': {
        const useCase = new SubscribeUseCase(repository, paymentGateway, notifier);
        const subscription = await useCase.execute({
          customerId: flags.customer,
          planId: flags.plan as PlanId,
        });
        print(subscription);
        break;
      }
      case 'change-plan': {
        const useCase = new ChangePlanUseCase(repository, paymentGateway, notifier);
        const result = await useCase.execute({
          subscriptionId: flags.id,
          newPlanId: flags.plan as PlanId,
        });
        print(result);
        break;
      }
      case 'cancel': {
        const useCase = new CancelUseCase(repository, notifier);
        const subscription = await useCase.execute({ subscriptionId: flags.id });
        print(subscription);
        break;
      }
      case 'get': {
        const useCase = new GetSubscriptionUseCase(repository);
        const subscription = await useCase.execute({ subscriptionId: flags.id });
        print(subscription);
        break;
      }
      default:
        console.error(
          `Unknown command "${command ?? ''}". Use one of: subscribe | change-plan | cancel | get`,
        );
        process.exitCode = 1;
    }
  } catch (error) {
    if (error instanceof DomainError) {
      // Same DomainError the HTTP filter catches — the CLI just presents it differently.
      console.error(`Domain error [${error.code}]: ${error.message}`);
      process.exitCode = 1;
    } else {
      throw error;
    }
  } finally {
    await close();
  }
}

main();
