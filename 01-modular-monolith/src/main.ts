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
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('E-Shop API')
    .setDescription(
      'Modular monolith reference: Identity, Catalog, Basket, and Ordering modules with strict boundaries. ' +
        'Domain events flow through RabbitMQ; Inventory and Notifications are async consumers. ' +
        'PostgreSQL uses schema-per-module; Redis provides cache-aside and sessions.\n\n' +
        '**Auth flow:** `POST /auth/register` or `POST /auth/login` → copy `accessToken` → ' +
        'click **Authorize** and paste the token for Basket and Ordering routes.',
    )
    .setVersion('1.0')
    .addTag('identity', 'Registration, login, JWT issuance (auth module)')
    .addTag('catalog', 'Products and categories — public, no auth required')
    .addTag('basket', 'Shopping cart — requires Bearer token')
    .addTag('ordering', 'Place, list, view, and cancel orders — requires Bearer token')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  app.enableShutdownHooks();

  const port = config.get<number>('PORT', 3000);
  await app.listen(port);
  logger.log(`E-Shop API listening on port ${port} (docs at /docs)`);
}

bootstrap();
