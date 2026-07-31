import { GeoShardingStrategy } from './geo-sharding.strategy';

describe('GeoShardingStrategy', () => {
  const strategy = new GeoShardingStrategy({
    africa: 0,
    europe: 1,
    asia: 2,
  });

  it.each([
    ['africa', 0],
    ['europe', 1],
    ['asia', 2],
  ])('routes region %s to shard %i', (region, expectedShard) => {
    expect(strategy.resolveShard(1, { region })).toBe(expectedShard);
  });

  it('is case-insensitive', () => {
    expect(strategy.resolveShard(1, { region: 'Africa' })).toBe(0);
    expect(strategy.resolveShard(1, { region: 'EUROPE' })).toBe(1);
  });

  it('falls back to the default shard for an unknown region', () => {
    expect(strategy.resolveShard(1, { region: 'antarctica' })).toBe(0);
  });

  it('throws when no region is provided', () => {
    expect(() => strategy.resolveShard(1)).toThrow();
  });

  it('honors a custom default shard', () => {
    const customDefault = new GeoShardingStrategy({ africa: 0, europe: 1 }, 1);
    expect(customDefault.resolveShard(1, { region: 'oceania' })).toBe(1);
  });
});
