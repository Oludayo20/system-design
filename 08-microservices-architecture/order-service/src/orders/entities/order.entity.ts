import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Lives only in order-db. `bookId` here is just a UUID string this table
 * stores for reference - order-db has no foreign key into catalog-db (it
 * can't; they're different Postgres instances with different credentials)
 * and no join is ever possible or attempted. Price is captured at order
 * time (`unitPriceCents`) rather than looked up again later, exactly like
 * you would in a real system where the catalog price can change after an
 * order ships.
 */
@Entity({ name: 'orders' })
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'book_id' })
  bookId: string;

  @Column({ type: 'integer' })
  quantity: number;

  @Column({ name: 'unit_price_cents', type: 'integer' })
  unitPriceCents: number;

  @Column({ name: 'total_cents', type: 'integer' })
  totalCents: number;

  @Column({ default: 'confirmed' })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
