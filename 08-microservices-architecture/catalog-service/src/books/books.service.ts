import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Book } from './entities/book.entity';
import { CreateBookDto } from './dto/create-book.dto';

@Injectable()
export class BooksService {
  constructor(@InjectRepository(Book) private readonly books: Repository<Book>) {}

  create(dto: CreateBookDto): Promise<Book> {
    return this.books.save(this.books.create(dto));
  }

  findAll(): Promise<Book[]> {
    return this.books.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<Book> {
    const book = await this.books.findOne({ where: { id } });
    if (!book) {
      throw new NotFoundException(`Book ${id} not found`);
    }
    return book;
  }

  /**
   * Atomically decrements stock in a single conditional UPDATE
   * (`WHERE id = :id AND stock >= :quantity`) so two concurrent reservations
   * can never both succeed against the same last unit - the second one's
   * WHERE clause simply matches zero rows. This is the operation
   * order-service calls over HTTP instead of touching catalog-db directly.
   */
  async reserve(
    id: string,
    quantity: number,
  ): Promise<{ bookId: string; unitPriceCents: number; totalCents: number; remainingStock: number }> {
    if (quantity < 1) {
      throw new BadRequestException('quantity must be at least 1');
    }

    const book = await this.findOne(id);

    const result = await this.books
      .createQueryBuilder()
      .update(Book)
      .set({ stock: () => 'stock - :quantity' })
      .where('id = :id AND stock >= :quantity', { id, quantity })
      .setParameter('quantity', quantity)
      .execute();

    if (!result.affected) {
      throw new ConflictException(
        `Insufficient stock for "${book.title}" (have ${book.stock}, requested ${quantity})`,
      );
    }

    return {
      bookId: id,
      unitPriceCents: book.priceCents,
      totalCents: book.priceCents * quantity,
      remainingStock: book.stock - quantity,
    };
  }
}
