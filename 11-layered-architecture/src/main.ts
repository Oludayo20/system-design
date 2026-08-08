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
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Riverside Library API')
    .setDescription(
      'N-Tier / Layered Architecture reference: every request flows one direction only — ' +
        'Presentation -> Application -> Domain -> Data Access -> Database. ' +
        'The Domain layer (business rules) is plain TypeScript with zero framework imports.\n\n' +
        '**Try the borrowing rules:** create a book with `totalCopies: 1`, create a member, then ' +
        '`POST /loans` to borrow, and try to borrow again to see the domain reject it.',
    )
    .setVersion('1.0')
    .addTag('books', 'Catalog of books and copy counts')
    .addTag('members', 'Library members')
    .addTag('loans', 'Borrowing and returning books — where all 4 business rules apply')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  app.enableShutdownHooks();

  const port = config.get<number>('PORT', 3011);
  await app.listen(port);
  logger.log(`Riverside Library API listening on port ${port} (docs at /docs)`);
}

bootstrap();
