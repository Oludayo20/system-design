import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum LedgerEntryType {
  CREDIT = 'CREDIT',
  DEBIT = 'DEBIT',
}

/** Append-only ledger. Wallet.balanceCents is a cached sum, this is the audit trail. */
@Entity({ name: 'wallet_ledger_entries' })
export class WalletLedgerEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'wallet_id' })
  walletId: string;

  @Column({ type: 'enum', enum: LedgerEntryType })
  type: LedgerEntryType;

  @Column({ name: 'amount_cents', type: 'integer' })
  amountCents: number;

  @Column()
  reason: string;

  // e.g. the orderId that triggered a settlement debit.
  @Column({ name: 'reference_id', nullable: true })
  referenceId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
