import { randomUUID } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { CreateBookDto } from '../presentation/dto/create-book.dto';
import { BOOK_REPOSITORY, BookRepositoryPort } from '../domain/book-repository.port';
import { Book } from '../domain/book.entity';

/**
 * Application layer. Orchestrates a single use case — it does not itself decide any business
 * rule; here there isn't even a rule to ask, just a step to run: build the domain object and
 * hand it to the repository port.
 */
@Injectable()
export class CreateBookUseCase {
  constructor(@Inject(BOOK_REPOSITORY) private readonly bookRepository: BookRepositoryPort) {}

  async execute(dto: CreateBookDto): Promise<Book> {
    const book = new Book(
      randomUUID(),
      dto.title,
      dto.author,
      dto.isbn,
      dto.totalCopies,
      dto.totalCopies, // a freshly catalogued book starts fully available
    );
    return this.bookRepository.save(book);
  }
}
