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
    .setTitle('Async Queue Processing — Reference API')
    .setDescription(
      'Producer/queue/consumer pattern demonstrated with RabbitMQ.\n\n' +
        '**This API (producer):** `POST /rides` — the only HTTP endpoint.\n\n' +
        '**Background workers** (separate process, not in Swagger): Email, Analytics, and Loyalty ' +
        'consumers on `email.queue`, `analytics.queue`, `loyalty.queue` with retry + dead-letter handling.\n\n' +
        '**Kafka** (standalone scripts, not HTTP): `npm run kafka:produce` / `kafka:consume:*` for broadcast comparison.',
    )
    .setVersion('1.0')
    .addTag('rides', 'Ride completion producer — publishes to RabbitMQ')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const config = app.get(ConfigService);
  const port = config.get<number>('port') ?? 3000;
  await app.listen(port);
  Logger.log(`API listening on port ${port} (docs at /docs)`, 'Bootstrap');
}

bootstrap();
