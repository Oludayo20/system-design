import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Colocated with its owning User on the same shard database (both keyed by
 * hash(userId) % SHARD_COUNT). This is a deliberate sharding-best-practice
 * decision, not an accident: a wallet is meaningless without its user, and
 * the two are almost always read/written together (profile view shows
 * balance; order settlement debits the wallet for a specific user). Storing
 * them on the same physical Postgres instance means every wallet operation
 * is a single-shard, single-database transaction - no distributed
 * transaction/2PC across shards is ever needed for the user+wallet unit.
 */
@Entity({ name: 'wallets' })
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', unique: true })
  userId: string;

  @Column({ name: 'balance_cents', type: 'integer', default: 0 })
  balanceCents: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
