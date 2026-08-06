import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Resilience Demo')
    .setDescription(
      'Application-level resilience patterns around a flaky payment provider.\n\n' +
        '**Endpoints:**\n' +
        '- `POST /checkout` — retry + circuit breaker + provider fallback\n' +
        '- `GET /checkout/circuit` — inspect circuit breaker state\n\n' +
        '**Env tuning:** `PAYMENT_FAILURE_RATE`, `CIRCUIT_FAILURE_THRESHOLD`, `MAX_RETRIES`, `RETRY_DELAY_MS`',
    )
    .setVersion('1.0')
    .addTag('checkout', 'Payment checkout with retries, circuit breaker, and fallback')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  const port = config.get<number>('PORT', 3005);
  await app.listen(port);
  logger.log(`Resilience API listening on port ${port} (docs at /docs)`);
}

bootstrap();
