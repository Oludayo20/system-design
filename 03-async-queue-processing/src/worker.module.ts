import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { RabbitmqModule } from './common/rabbitmq/rabbitmq.module';
import { WorkersModule } from './workers/workers.module';

/** Consumer process: no HTTP server, no controllers. Scales independently via --scale worker=N. */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    RabbitmqModule,
    WorkersModule,
  ],
})
export class WorkerModule {}
