import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Data Access layer. This is the ONLY book-shaped class allowed to know about TypeORM
 * decorators or the database schema. It is deliberately separate from books/domain/book.entity.ts
 * (the pure domain class) — the ORM row shape and the business object shape are allowed to
 * diverge without either layer noticing.
 */
@Entity({ name: 'books' })
export class BookOrmEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'varchar', length: 255 })
  author!: string;

  @Column({ type: 'varchar', length: 20 })
  isbn!: string;

  @Column({ name: 'total_copies', type: 'int' })
  totalCopies!: number;

  @Column({ name: 'available_copies', type: 'int' })
  availableCopies!: number;
}
