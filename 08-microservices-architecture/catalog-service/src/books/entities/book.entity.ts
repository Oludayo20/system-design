import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Lives only in catalog-db. order-service NEVER queries this table - it
 * asks catalog-service for price/stock over HTTP (`POST /books/:id/reserve`)
 * and gets back a plain JSON response. That HTTP hop is the entire point of
 * this project: it's the "Good" half of the bad/good example in the README.
 */
@Entity({ name: 'books' })
export class Book {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column()
  author: string;

  @Column({ name: 'price_cents', type: 'integer' })
  priceCents: number;

  @Column({ type: 'integer' })
  stock: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
