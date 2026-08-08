import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Data Access layer. TypeORM row shape — kept separate from the pure domain Loan class. */
@Entity({ name: 'loans' })
export class LoanOrmEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'book_id', type: 'uuid' })
  bookId!: string;

  @Column({ name: 'member_id', type: 'uuid' })
  memberId!: string;

  @Column({ name: 'borrowed_at', type: 'timestamp' })
  borrowedAt!: Date;

  @Column({ name: 'due_at', type: 'timestamp' })
  dueAt!: Date;

  @Column({ name: 'returned_at', type: 'timestamp', nullable: true })
  returnedAt!: Date | null;
}
