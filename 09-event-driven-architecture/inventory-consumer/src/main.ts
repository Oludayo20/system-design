import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/**
 * Independent app, independent process, independent port. Nothing in order-api imports or
 * knows about this file.
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const port = config.get<number>('port') ?? 4101;
  await app.listen(port);
  Logger.log(
    `inventory-consumer listening on port ${port} — GET /stock to inspect`,
    'Bootstrap',
  );
}

bootstrap();
