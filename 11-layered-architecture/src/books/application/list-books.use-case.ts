import { Inject, Injectable } from '@nestjs/common';
import { BOOK_REPOSITORY, BookRepositoryPort } from '../domain/book-repository.port';
import { Book } from '../domain/book.entity';

@Injectable()
export class ListBooksUseCase {
  constructor(@Inject(BOOK_REPOSITORY) private readonly bookRepository: BookRepositoryPort) {}

  async execute(): Promise<Book[]> {
    return this.bookRepository.findAll();
  }
}
