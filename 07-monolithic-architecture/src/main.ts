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
    .setTitle('BlogStack API')
    .setDescription(
      'Plain monolith reference: Auth, Users, Posts, Comments, and Notifications all in one ' +
        'NestJS application, one process, one shared PostgreSQL database. Modules import each ' +
        "other's services directly — no event bus, no enforced boundaries.\n\n" +
        '**Auth flow:** `POST /auth/register` or `POST /auth/login` → copy `accessToken` → ' +
        'click **Authorize** and paste the token for the protected routes.',
    )
    .setVersion('1.0')
    .addTag('auth', 'Registration, login, JWT issuance')
    .addTag('users', 'User profile — requires Bearer token')
    .addTag('posts', 'Create/list/get posts — reading is public, creating requires a Bearer token')
    .addTag('comments', 'Add/list comments on a post — reading is public, adding requires a Bearer token')
    .addTag('notifications', "Read-only view of the current user's notifications — requires a Bearer token")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  app.enableShutdownHooks();

  const port = config.get<number>('PORT', 3007);
  await app.listen(port);
  logger.log(`BlogStack API listening on port ${port} (docs at /docs)`);
}

bootstrap();
