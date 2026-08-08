import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BooksModule } from './books/infrastructure/books.module';
import { LoansModule } from './loans/infrastructure/loans.module';
import { MembersModule } from './members/infrastructure/members.module';

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
        username: config.get<string>('POSTGRES_USER', 'library'),
        password: config.get<string>('POSTGRES_PASSWORD', 'library_dev_password'),
        database: config.get<string>('POSTGRES_DB', 'library'),
        autoLoadEntities: true,
        // Never true here: schema changes ship as reviewed migrations
        // (src/infrastructure/postgres/migrations), not drift-on-boot.
        synchronize: false,
      }),
    }),

    // Feature modules, each internally layered Presentation -> Application -> Domain -> Data Access.
    BooksModule,
    MembersModule,
    LoansModule,
  ],
})
export class AppModule {}
