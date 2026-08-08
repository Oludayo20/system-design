import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration, { AppConfig } from './config/configuration';
import { User } from './auth/entities/user.entity';
import { AuthModule } from './auth/auth.module';
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
        entities: [User],
        // Demo-only: keeps the schema in lockstep with the User entity without a
        // migration step. A real service would run TypeORM migrations in its deploy
        // pipeline and set this to false unconditionally (same tradeoff documented
        // in 03-async-queue-processing).
        synchronize: true,
      }),
    }),
    AuthModule,
    HealthModule,
  ],
})
export class AppModule {}
