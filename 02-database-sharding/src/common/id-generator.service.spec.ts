import { IdGeneratorService } from './id-generator.service';

describe('IdGeneratorService', () => {
  it('generates unique, safe-integer ids under a tight loop', () => {
    const generator = new IdGeneratorService();
    const ids = new Set<number>();

    for (let i = 0; i < 5000; i++) {
      const id = generator.nextId();
      expect(Number.isSafeInteger(id)).toBe(true);
      ids.add(id);
    }

    expect(ids.size).toBe(5000);
  });

  it('produces increasing ids over time', () => {
    const generator = new IdGeneratorService();
    const first = generator.nextId();
    const second = generator.nextId();
    expect(second).toBeGreaterThan(first);
  });
});
