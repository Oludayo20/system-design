import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Database Sharding Demo')
    .setDescription(
      'NestJS API routing user records across three independent PostgreSQL shards. ' +
        'Switch strategies via `SHARDING_STRATEGY` env var: `hash` (default), `range`, or `geo`.\n\n' +
        '**Endpoints:**\n' +
        '- `POST /users` — create (id generated, then routed)\n' +
        '- `GET /users/:id` — single-shard lookup\n' +
        '- `GET /users/_debug/distribution` — ops-only fan-out to all shards',
    )
    .setVersion('1.0')
    .addTag('users', 'Sharded user CRUD and debug distribution')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Sharding demo listening on port ${port} (Swagger at /docs)`);
}

bootstrap();
