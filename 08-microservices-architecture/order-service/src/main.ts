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
    .setTitle('BookHive Order Service')
    .setDescription(
      'Owns order-db exclusively - has NO catalog-db or auth-db connection info anywhere ' +
        'in its environment. Reaches catalog-service only over HTTP.\n\n' +
        '**Endpoints:**\n' +
        '- `POST /orders` — place an order (auth required)\n' +
        '- `GET /orders` — list your orders\n' +
        '- `GET /orders/:id` — get one of your orders\n\n' +
        'Placing an order calls catalog-service synchronously (must succeed) and ' +
        'notification-service fire-and-forget (may fail silently - fault isolation).',
    )
    .setVersion('1.0')
    .addTag('orders')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  const port = config.get<number>('port', 4003);
  await app.listen(port);
  logger.log(`Order Service listening on port ${port} (docs at /docs)`);
}

bootstrap();
