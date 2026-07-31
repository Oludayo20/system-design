import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';

/**
 * Standalone Nest application context — no HTTP listener. This is what `docker compose up
 * --scale worker=N` runs N copies of; each replica independently connects to RabbitMQ and
 * competes for messages on email.queue/analytics.queue/loyalty.queue.
 */
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  app.enableShutdownHooks();
  Logger.log(
    'Worker process started: consuming email.queue, analytics.queue, loyalty.queue',
    'Bootstrap',
  );
}

bootstrap();
