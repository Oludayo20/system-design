import { Injectable } from '@nestjs/common';

export interface NodeSnapshot {
  name: string;
  productViews: number;
  walletBalance: number;
}

@Injectable()
export class ClusterService {
  private partitioned = false;

  private nodeA: NodeSnapshot = { name: 'A', productViews: 1250, walletBalance: 5000 };
  private nodeB: NodeSnapshot = { name: 'B', productViews: 1250, walletBalance: 5000 };

  setPartitioned(value: boolean): void {
    this.partitioned = value;
  }

  isPartitioned(): boolean {
    return this.partitioned;
  }

  getNodes(): NodeSnapshot[] {
    return [this.nodeA, this.nodeB];
  }

  /**
   * AP choice: accept the write locally even if nodes cannot sync.
   * Reads may disagree briefly (eventual consistency).
   */
  incrementProductViews(): { accepted: true; node: string; views: number } {
    this.nodeA.productViews += 1;

    if (!this.partitioned) {
      this.nodeB.productViews = this.nodeA.productViews;
    }

    return {
      accepted: true,
      node: 'A',
      views: this.nodeA.productViews,
    };
  }

  /**
   * CP choice: require both nodes to agree before accepting a wallet mutation.
   * During a partition, reject the write instead of risking divergent balances.
   */
  debitWallet(amount: number):
    | { accepted: true; balance: number }
    | { accepted: false; reason: string } {
    if (this.partitioned) {
      return {
        accepted: false,
        reason: 'Partition detected: wallet writes rejected to preserve consistency (CP)',
      };
    }

    if (this.nodeA.walletBalance < amount) {
      return { accepted: false, reason: 'Insufficient funds' };
    }

    const next = this.nodeA.walletBalance - amount;
    this.nodeA.walletBalance = next;
    this.nodeB.walletBalance = next;

    return { accepted: true, balance: next };
  }

  /** Simulate background replication after a partition heals. */
  reconcile(): { productViews: number; walletBalance: number } {
    this.partitioned = false;
    this.nodeB.productViews = this.nodeA.productViews;
    this.nodeB.walletBalance = this.nodeA.walletBalance;

    return {
      productViews: this.nodeA.productViews,
      walletBalance: this.nodeA.walletBalance,
    };
  }
}
