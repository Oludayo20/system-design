import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ShardRouterService } from '../../sharding/shard-router.service';
import { Wallet } from './entities/wallet.entity';
import { LedgerEntryType, WalletLedgerEntry } from './entities/wallet-ledger-entry.entity';

export const SIGNUP_BONUS_CENTS = 500000; // demo "welcome bonus" so settlement debits have something to draw from

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(private readonly shardRouter: ShardRouterService) {}

  async getWallet(userId: string): Promise<Wallet> {
    const repo = this.shardRouter.getRepository(Wallet, userId);
    const wallet = await repo.findOne({ where: { userId } });
    if (!wallet) {
      throw new NotFoundException(`Wallet for user ${userId} not found`);
    }
    return wallet;
  }

  async getLedger(userId: string, limit = 20): Promise<WalletLedgerEntry[]> {
    const wallet = await this.getWallet(userId);
    const dataSource = this.shardRouter.getDataSourceForUser(userId);
    return dataSource.getRepository(WalletLedgerEntry).find({
      where: { walletId: wallet.id },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Credit and debit both run inside a transaction scoped to the user's
   * OWN shard - this only works cleanly because Wallet is colocated with
   * its owning User (see Wallet entity doc comment). A cross-shard wallet
   * transfer would need a saga/2PC; a same-shard debit is just a normal
   * ACID transaction.
   */
  async credit(
    userId: string,
    amountCents: number,
    reason: string,
    referenceId?: string,
  ): Promise<Wallet> {
    return this.applyLedgerEntry(userId, LedgerEntryType.CREDIT, amountCents, reason, referenceId);
  }

  async debit(
    userId: string,
    amountCents: number,
    reason: string,
    referenceId?: string,
  ): Promise<Wallet> {
    return this.applyLedgerEntry(userId, LedgerEntryType.DEBIT, amountCents, reason, referenceId);
  }

  private async applyLedgerEntry(
    userId: string,
    type: LedgerEntryType,
    amountCents: number,
    reason: string,
    referenceId?: string,
  ): Promise<Wallet> {
    const dataSource = this.shardRouter.getDataSourceForUser(userId);

    return dataSource.transaction(async (manager) => {
      const wallet = await manager.findOne(Wallet, {
        where: { userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!wallet) {
        throw new NotFoundException(`Wallet for user ${userId} not found`);
      }

      const delta = type === LedgerEntryType.CREDIT ? amountCents : -amountCents;
      wallet.balanceCents += delta;
      if (wallet.balanceCents < 0) {
        this.logger.warn(
          `Wallet ${wallet.id} balance went negative (${wallet.balanceCents}) after ${type} of ${amountCents} for "${reason}" - allowed in this demo, would be rejected/flagged in production`,
        );
      }
      await manager.save(Wallet, wallet);

      const entry = manager.create(WalletLedgerEntry, {
        walletId: wallet.id,
        type,
        amountCents,
        reason,
        referenceId: referenceId ?? null,
      });
      await manager.save(WalletLedgerEntry, entry);

      return wallet;
    });
  }
}
