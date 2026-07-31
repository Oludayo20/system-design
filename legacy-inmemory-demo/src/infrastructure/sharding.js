import { Database } from './database.js';

/**
 * Simulates splitting one logical database across multiple physical shards.
 * doc.md: "Instead of one huge database ... you split it into smaller
 * databases", and the worked example `userId % 3` for users 15, 230, 987, 1500.
 */
export class ShardRouter {
  constructor(numShards, strategy = 'hash') {
    this.numShards = numShards;
    this.strategy = strategy; // 'hash' or 'range'
    this.shards = Array.from({ length: numShards }, (_, i) => new Database(`shard-${i}`));
  }

  shardIndexFor(userId) {
    if (this.strategy === 'hash') {
      return userId % this.numShards; // doc.md Strategy 2: Hashing
    }
    // doc.md Strategy 1: range-based (e.g. 1-3,000,000 -> Shard 1, etc.)
    const rangeSize = Math.ceil(Number.MAX_SAFE_INTEGER / this.numShards);
    return Math.min(this.numShards - 1, Math.floor(userId / rangeSize));
  }

  dbFor(userId) {
    return this.shards[this.shardIndexFor(userId)];
  }

  async writeUser(userId, record) {
    const shardIndex = this.shardIndexFor(userId);
    await this.shards[shardIndex].insert('users', record);
    return shardIndex;
  }

  async readUser(userId) {
    const shardIndex = this.shardIndexFor(userId);
    const record = await this.shards[shardIndex].find('users', (u) => u.id === userId);
    return { shardIndex, record };
  }

  distributionSummary() {
    return this.shards.map((db, i) => ({ shard: i, users: db.table('users').length }));
  }
}
