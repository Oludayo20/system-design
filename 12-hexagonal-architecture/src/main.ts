import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { DomainErrorFilter } from './adapters/in/http/domain-error.filter';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  app.useGlobalFilters(new DomainErrorFilter());

  const repository = config.get<string>('REPOSITORY', 'memory');
  const paymentProvider = config.get<string>('PAYMENT_PROVIDER', 'stripe');

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Orbit — Subscription Billing (Hexagonal Architecture)')
    .setDescription(
      'Ports & Adapters demo. The core billing domain (src/core) has zero framework imports — ' +
        'the REST controller and a CLI drive it as inbound adapters; Postgres/in-memory ' +
        'repositories and Stripe/Flutterwave mock gateways plug into it as outbound adapters.\n\n' +
        `**Active adapters:** REPOSITORY=${repository}, PAYMENT_PROVIDER=${paymentProvider}\n\n` +
        '**Endpoints:**\n' +
        '- `POST /subscriptions` — subscribe (charges plan price)\n' +
        '- `POST /subscriptions/:id/change-plan` — upgrade (prorated charge) or attempt downgrade (rejected mid-cycle)\n' +
        '- `POST /subscriptions/:id/cancel` — schedule cancellation at period end\n' +
        '- `GET /subscriptions/:id` — read a subscription',
    )
    .setVersion('1.0')
    .addTag('subscriptions', 'Subscribe, change plan, cancel, and read subscriptions')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  const port = config.get<number>('PORT', 3012);
  await app.listen(port);
  logger.log(`Orbit API listening on port ${port} (docs at /docs)`);
  logger.log(`Adapters in use — REPOSITORY=${repository}, PAYMENT_PROVIDER=${paymentProvider}`);
}

bootstrap();
