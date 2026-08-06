import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Oja Marketplace Capstone API')
    .setDescription(
      'Full-stack system design capstone: modular monolith + sharded Postgres (Users/Wallet) + ' +
        'async RabbitMQ workers + Redis cache + horizontal scaling behind Nginx.\n\n' +
        '**Public routes:** `auth/*`, `marketplace/*`, `health`\n\n' +
        '**Protected routes:** `users/me`, `wallet/me`, `orders` — register/login first, then **Authorize** with the JWT.\n\n' +
        '**Background workers** (not HTTP): Email, Inventory, Analytics, Wallet settlement on `order.created`.',
    )
    .setVersion('1.0')
    .addTag('auth', 'Register and login; writes shard + directory')
    .addTag('users', 'Sharded user profile — requires JWT')
    .addTag('marketplace', 'Products and categories on primary DB')
    .addTag('orders', 'Place orders — requires JWT')
    .addTag('wallet', 'Balance and ledger on user shard — requires JWT')
    .addTag('health', 'Load balancer / orchestration health probe')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const port = config.get<number>('port')!;
  const instanceId = config.get<string>('instanceId')!;
  await app.listen(port);
  logger.log(`[${instanceId}] Oja Marketplace Capstone listening on port ${port} (docs at /docs)`);
}

bootstrap();
