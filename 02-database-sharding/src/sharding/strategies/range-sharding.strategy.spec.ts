import { RangeShardingStrategy } from './range-sharding.strategy';

describe('RangeShardingStrategy', () => {
  // Mirrors the doc's example: Users 1-3M -> Shard 0, 3M-6M -> Shard 1, 6M+ -> Shard 2
  const strategy = new RangeShardingStrategy([3_000_000, 6_000_000, Infinity]);

  it.each([
    [1, 0],
    [3_000_000, 0],
    [3_000_001, 1],
    [6_000_000, 1],
    [6_000_001, 2],
    [15_345_678, 2],
  ])('routes id %i to shard %i', (id, expectedShard) => {
    expect(strategy.resolveShard(id)).toBe(expectedShard);
  });

  it('accepts numeric strings', () => {
    expect(strategy.resolveShard('4000000')).toBe(1);
  });

  it('rejects non-numeric keys', () => {
    expect(() => strategy.resolveShard('not-a-number')).toThrow();
  });

  it('rejects boundaries that are not strictly ascending', () => {
    expect(() => new RangeShardingStrategy([100, 100])).toThrow();
    expect(() => new RangeShardingStrategy([100, 50])).toThrow();
  });

  it('rejects an empty boundary list', () => {
    expect(() => new RangeShardingStrategy([])).toThrow();
  });
});
