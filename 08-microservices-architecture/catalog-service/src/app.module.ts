import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration, { AppConfig } from './config/configuration';
import { Book } from './books/entities/book.entity';
import { BooksModule } from './books/books.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        ...config.get<AppConfig['db']>('db')!,
        entities: [Book],
        // Demo-only, see auth-service/src/app.module.ts for the full rationale.
        synchronize: true,
      }),
    }),
    BooksModule,
    HealthModule,
  ],
})
export class AppModule {}
