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
      'Modular monolith + sharded Postgres (Users/Wallet) + RabbitMQ async workers, behind Nginx with 2 API replicas.',
    )
    .setVersion('1.0')
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
