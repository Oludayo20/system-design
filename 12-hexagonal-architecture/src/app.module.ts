import { Module, Provider } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubscriptionController } from './adapters/in/http/subscription.controller';
import { ConsoleNotifierAdapter } from './adapters/out/notification/console-notifier.adapter';
import { FlutterwaveMockAdapter } from './adapters/out/payment/flutterwave-mock.adapter';
import { StripeMockAdapter } from './adapters/out/payment/stripe-mock.adapter';
import { InMemorySubscriptionRepository } from './adapters/out/persistence/in-memory-subscription.repository';
import { PostgresSubscriptionRepository } from './adapters/out/persistence/postgres-subscription.repository';
import { SubscriptionOrmEntity } from './adapters/out/persistence/subscription.orm-entity';
import { CancelUseCase } from './core/application/cancel.use-case';
import { ChangePlanUseCase } from './core/application/change-plan.use-case';
import { GetSubscriptionUseCase } from './core/application/get-subscription.use-case';
import { SubscribeUseCase } from './core/application/subscribe.use-case';
import { NOTIFIER_PORT } from './core/ports/out/notifier.port';
import { PAYMENT_GATEWAY_PORT } from './core/ports/out/payment-gateway.port';
import { SUBSCRIPTION_REPOSITORY_PORT } from './core/ports/out/subscription-repository.port';

// Read directly from process.env (not ConfigService) because @Module() metadata is evaluated at
// class-definition time, before Nest has bootstrapped ConfigModule. This is the one place in the
// whole project that decides which adapters plug into which ports.
const repositoryKind = (process.env.REPOSITORY ?? 'memory').toLowerCase();
const paymentProvider = (process.env.PAYMENT_PROVIDER ?? 'stripe').toLowerCase();
const usePostgres = repositoryKind === 'postgres';

/**
 * Custom providers binding each OUTPUT port token to a concrete adapter class. This is the
 * dependency-inversion wiring the whole project demonstrates: swap `REPOSITORY` or
 * `PAYMENT_PROVIDER` and only this list changes — nothing in src/core does.
 */
const repositoryProvider: Provider = usePostgres
  ? {
      provide: SUBSCRIPTION_REPOSITORY_PORT,
      useFactory: (repo: Repository<SubscriptionOrmEntity>) =>
        new PostgresSubscriptionRepository(repo),
      inject: [getRepositoryToken(SubscriptionOrmEntity)],
    }
  : {
      provide: SUBSCRIPTION_REPOSITORY_PORT,
      useClass: InMemorySubscriptionRepository,
    };

const paymentGatewayProvider: Provider = {
  provide: PAYMENT_GATEWAY_PORT,
  useClass: paymentProvider === 'flutterwave' ? FlutterwaveMockAdapter : StripeMockAdapter,
};

const notifierProvider: Provider = {
  provide: NOTIFIER_PORT,
  useClass: ConsoleNotifierAdapter,
};

// The use-case classes (src/core/application) have zero decorators — they can't be discovered
// by Nest's class scanner. Each is registered with an explicit useFactory that injects the port
// tokens above, which is where DI wires interfaces to concrete adapters.
const useCaseProviders: Provider[] = [
  {
    provide: SubscribeUseCase,
    useFactory: (repo, gateway, notifier) => new SubscribeUseCase(repo, gateway, notifier),
    inject: [SUBSCRIPTION_REPOSITORY_PORT, PAYMENT_GATEWAY_PORT, NOTIFIER_PORT],
  },
  {
    provide: ChangePlanUseCase,
    useFactory: (repo, gateway, notifier) => new ChangePlanUseCase(repo, gateway, notifier),
    inject: [SUBSCRIPTION_REPOSITORY_PORT, PAYMENT_GATEWAY_PORT, NOTIFIER_PORT],
  },
  {
    provide: CancelUseCase,
    useFactory: (repo, notifier) => new CancelUseCase(repo, notifier),
    inject: [SUBSCRIPTION_REPOSITORY_PORT, NOTIFIER_PORT],
  },
  {
    provide: GetSubscriptionUseCase,
    useFactory: (repo) => new GetSubscriptionUseCase(repo),
    inject: [SUBSCRIPTION_REPOSITORY_PORT],
  },
];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ...(usePostgres
      ? [
          TypeOrmModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
              type: 'postgres' as const,
              host: config.get<string>('POSTGRES_HOST', 'localhost'),
              port: config.get<number>('POSTGRES_PORT', 5432),
              username: config.get<string>('POSTGRES_USER', 'orbit'),
              password: config.get<string>('POSTGRES_PASSWORD', 'orbit_dev_password'),
              database: config.get<string>('POSTGRES_DB', 'orbit'),
              entities: [SubscriptionOrmEntity],
              // Never true here: schema changes ship as reviewed migrations
              // (src/adapters/out/persistence/migrations), not drift-on-boot.
              synchronize: false,
            }),
          }),
          TypeOrmModule.forFeature([SubscriptionOrmEntity]),
        ]
      : []),
  ],
  controllers: [SubscriptionController],
  providers: [repositoryProvider, paymentGatewayProvider, notifierProvider, ...useCaseProviders],
})
export class AppModule {}
