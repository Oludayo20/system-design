import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreateBookUseCase } from '../application/create-book.use-case';
import { GetBookUseCase } from '../application/get-book.use-case';
import { ListBooksUseCase } from '../application/list-books.use-case';
import { BOOK_REPOSITORY } from '../domain/book-repository.port';
import { BooksController } from '../presentation/books.controller';
import { BookOrmEntity } from './book.orm-entity';
import { TypeOrmBookRepository } from './typeorm-book.repository';

/**
 * Wires the four layers together via DI tokens. This is the only place that decides
 * TypeOrmBookRepository is the concrete implementation of BookRepositoryPort — swapping it
 * for an in-memory fake (for tests) or a different ORM means changing only this file.
 */
@Module({
  imports: [TypeOrmModule.forFeature([BookOrmEntity])],
  controllers: [BooksController],
  providers: [
    CreateBookUseCase,
    ListBooksUseCase,
    GetBookUseCase,
    { provide: BOOK_REPOSITORY, useClass: TypeOrmBookRepository },
  ],
  exports: [BOOK_REPOSITORY],
})
export class BooksModule {}
