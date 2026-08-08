import { Book } from './book.entity';

/**
 * A port (interface). The Domain and Application layers depend on this abstraction only.
 * The Data Access layer (books/infrastructure/typeorm-book.repository.ts) is the sole place
 * that implements it with a real ORM/database call.
 */
export interface BookRepositoryPort {
  save(book: Book): Promise<Book>;
  findById(id: string): Promise<Book | null>;
  findAll(): Promise<Book[]>;
}

/** DI token — lets Application-layer use-cases `@Inject` the port without knowing TypeORM exists. */
export const BOOK_REPOSITORY = Symbol('BOOK_REPOSITORY');
