import { HashShardingStrategy } from './hash-sharding.strategy';

describe('HashShardingStrategy', () => {
  describe('the doc worked example (userId % 3)', () => {
    const strategy = new HashShardingStrategy(3);

    it.each([
      [15, 0],
      [230, 2],
      [987, 0],
      [1500, 0],
    ])('routes userId %i to shard %i', (userId, expectedShard) => {
      expect(strategy.resolveShard(userId)).toBe(expectedShard);
    });
  });

  it('is deterministic - the same key always resolves to the same shard', () => {
    const strategy = new HashShardingStrategy(5);
    const shard = strategy.resolveShard(42);
    for (let i = 0; i < 10; i++) {
      expect(strategy.resolveShard(42)).toBe(shard);
    }
  });

  it('always returns an index within [0, shardCount)', () => {
    const shardCount = 4;
    const strategy = new HashShardingStrategy(shardCount);
    for (const userId of [0, 1, 3, 99, 100_000, 999_999_937]) {
      const shard = strategy.resolveShard(userId);
      expect(shard).toBeGreaterThanOrEqual(0);
      expect(shard).toBeLessThan(shardCount);
    }
  });

  it('hashes string keys to a stable, in-range shard', () => {
    const strategy = new HashShardingStrategy(3);
    const first = strategy.resolveShard('user@example.com');
    const second = strategy.resolveShard('user@example.com');
    expect(first).toBe(second);
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(3);
  });

  it('distributes a large key set roughly evenly across shards', () => {
    const shardCount = 3;
    const strategy = new HashShardingStrategy(shardCount);
    const counts = new Array(shardCount).fill(0);

    for (let userId = 1; userId <= 9000; userId++) {
      counts[strategy.resolveShard(userId)]++;
    }

    // Sequential integers mod 3 split perfectly evenly.
    for (const count of counts) {
      expect(count).toBe(3000);
    }
  });

  it('rejects an invalid shard count', () => {
    expect(() => new HashShardingStrategy(0)).toThrow();
  });
});
