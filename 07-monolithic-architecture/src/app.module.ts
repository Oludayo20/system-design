import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './modules/auth/auth.module';
import { CommentsModule } from './modules/comments/comments.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PostsModule } from './modules/posts/posts.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('POSTGRES_HOST', 'localhost'),
        port: config.get<number>('POSTGRES_PORT', 5432),
        username: config.get<string>('POSTGRES_USER', 'blogstack'),
        password: config.get<string>('POSTGRES_PASSWORD', 'blogstack_dev_password'),
        database: config.get<string>('POSTGRES_DB', 'blogstack'),
        autoLoadEntities: true,
        // Never true here: schema changes ship as reviewed migrations
        // (src/infrastructure/postgres/migrations), not drift-on-boot.
        synchronize: false,
      }),
    }),

    // One app, one process: every module below is wired into the same Nest application and
    // shares the same PostgreSQL connection pool. Contrast: 01-modular-monolith also does this,
    // but forbids the modules from calling each other's services directly. Here they do.
    UsersModule,
    AuthModule,
    PostsModule,
    CommentsModule,
    NotificationsModule,
  ],
})
export class AppModule {}
