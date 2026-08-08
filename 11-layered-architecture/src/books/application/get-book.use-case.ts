import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { BOOK_REPOSITORY, BookRepositoryPort } from '../domain/book-repository.port';
import { Book } from '../domain/book.entity';

@Injectable()
export class GetBookUseCase {
  constructor(@Inject(BOOK_REPOSITORY) private readonly bookRepository: BookRepositoryPort) {}

  async execute(id: string): Promise<Book> {
    const book = await this.bookRepository.findById(id);
    if (!book) {
      throw new NotFoundException(`No book with id ${id}.`);
    }
    return book;
  }
}
