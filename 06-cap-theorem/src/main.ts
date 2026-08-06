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
    .setTitle('CAP Theorem Demo')
    .setDescription(
      'Two in-memory nodes (A and B) demonstrating CAP tradeoffs during a simulated network partition.\n\n' +
        '**AP endpoint:** `POST /profile/view` — accepts writes locally, syncs later.\n\n' +
        '**CP endpoint:** `POST /wallet/debit` — rejects writes when nodes cannot agree.\n\n' +
        '**Admin:** `POST /admin/partition` to toggle partition; `POST /admin/reconcile` to heal.\n\n' +
        '**Inspect:** `GET /nodes` for side-by-side node state.',
    )
    .setVersion('1.0')
    .addTag('cluster', 'CAP theorem simulation — AP views vs CP wallet')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  const port = config.get<number>('PORT', 3006);
  await app.listen(port);
  logger.log(`CAP demo API listening on port ${port} (docs at /docs)`);
}

bootstrap();
