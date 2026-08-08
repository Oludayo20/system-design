import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BookRepositoryPort } from '../domain/book-repository.port';
import { Book } from '../domain/book.entity';
import { BookOrmEntity } from './book.orm-entity';

/**
 * Data Access layer. The only class that implements BookRepositoryPort with a real database
 * call. It converts between the ORM row shape (BookOrmEntity) and the pure domain object (Book)
 * at the boundary, so nothing above this layer ever sees a TypeORM type.
 */
@Injectable()
export class TypeOrmBookRepository implements BookRepositoryPort {
  constructor(
    @InjectRepository(BookOrmEntity)
    private readonly repository: Repository<BookOrmEntity>,
  ) {}

  async save(book: Book): Promise<Book> {
    const saved = await this.repository.save(this.toOrmEntity(book));
    return this.toDomain(saved);
  }

  async findById(id: string): Promise<Book | null> {
    const row = await this.repository.findOne({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findAll(): Promise<Book[]> {
    const rows = await this.repository.find();
    return rows.map((row) => this.toDomain(row));
  }

  private toDomain(row: BookOrmEntity): Book {
    return new Book(row.id, row.title, row.author, row.isbn, row.totalCopies, row.availableCopies);
  }

  private toOrmEntity(book: Book): BookOrmEntity {
    const row = new BookOrmEntity();
    row.id = book.id;
    row.title = book.title;
    row.author = book.author;
    row.isbn = book.isbn;
    row.totalCopies = book.totalCopies;
    row.availableCopies = book.availableCopies;
    return row;
  }
}
