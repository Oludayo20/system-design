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
    .setTitle('BookHive Auth Service')
    .setDescription(
      'Owns auth-db exclusively - no other BookHive service has its connection string.\n\n' +
        '**Endpoints:**\n' +
        '- `POST /auth/register` — create a user, receive a JWT\n' +
        '- `POST /auth/login` — receive a JWT\n' +
        '- `GET /auth/verify` — verify a bearer token by hand\n\n' +
        'catalog-service and order-service verify JWTs in-process against the same ' +
        '`JWT_SECRET` — they never call this service at request time.',
    )
    .setVersion('1.0')
    .addTag('auth')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  const port = config.get<number>('port', 4001);
  await app.listen(port);
  logger.log(`Auth Service listening on port ${port} (docs at /docs)`);
}

bootstrap();
