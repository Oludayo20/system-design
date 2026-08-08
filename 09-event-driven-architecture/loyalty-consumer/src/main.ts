import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const port = config.get<number>('port') ?? 4104;
  await app.listen(port);
  Logger.log(`loyalty-consumer listening on port ${port} — GET /points to inspect`, 'Bootstrap');
}

bootstrap();
