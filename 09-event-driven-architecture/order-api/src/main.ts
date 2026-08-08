import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('FreshCart order-api — Event-Driven Architecture Reference')
    .setDescription(
      'The only HTTP producer in this project.\n\n' +
        '`POST /orders` persists an order, commits the transaction, publishes `order.placed` ' +
        'to the `grocery_events` topic exchange, and returns — all in well under a second. ' +
        'It has zero code referencing inventory-consumer, notification-consumer, ' +
        'analytics-consumer, or loyalty-consumer; each of those is a separate app (own ' +
        'process, own port, own repo folder) that independently subscribes to the event. ' +
        'See the top-level README for the fan-out diagram and the idempotency/ordering demos.',
    )
    .setVersion('1.0')
    .addTag('orders', 'Order placement — the sole producer of order.placed')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  const config = app.get(ConfigService);
  const port = config.get<number>('port') ?? 3009;
  await app.listen(port);
  Logger.log(`order-api listening on port ${port} (docs at /docs)`, 'Bootstrap');
}

bootstrap();
