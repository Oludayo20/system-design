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
    .setTitle('BookHive Catalog Service')
    .setDescription(
      'Owns catalog-db exclusively - no other BookHive service has its connection string.\n\n' +
        '**Endpoints:**\n' +
        '- `POST /books` — add a book (auth required)\n' +
        '- `GET /books` — list books\n' +
        '- `GET /books/:id` — get one book\n' +
        '- `POST /books/:id/reserve` — atomically decrement stock (called by order-service over HTTP, not a direct DB write)',
    )
    .setVersion('1.0')
    .addTag('books')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  const port = config.get<number>('port', 4002);
  await app.listen(port);
  logger.log(`Catalog Service listening on port ${port} (docs at /docs)`);
}

bootstrap();
