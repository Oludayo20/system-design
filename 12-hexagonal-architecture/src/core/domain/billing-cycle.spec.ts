import { computeProration, daysBetween, daysRemaining } from './billing-cycle';

describe('billing-cycle (pure math, zero I/O)', () => {
  describe('computeProration', () => {
    it('computes (newPrice - oldPrice) * daysRemaining / daysInPeriod, rounded to 2 decimals', () => {
      const currentPeriodStart = new Date('2026-01-01T00:00:00.000Z');
      const currentPeriodEnd = new Date('2026-01-31T00:00:00.000Z'); // 30-day period
      const now = new Date('2026-01-16T00:00:00.000Z'); // 15 days remaining

      const amount = computeProration({
        oldPrice: 9,
        newPrice: 29,
        now,
        currentPeriodStart,
        currentPeriodEnd,
      });

      // (29 - 9) * 15 / 30 = 10.00
      expect(amount).toBe(10);
    });

    it('rounds to 2 decimal places for uneven splits', () => {
      const currentPeriodStart = new Date('2026-01-01T00:00:00.000Z');
      const currentPeriodEnd = new Date('2026-01-31T00:00:00.000Z'); // 30-day period
      const now = new Date('2026-01-21T00:00:00.000Z'); // 10 days remaining

      const amount = computeProration({
        oldPrice: 29,
        newPrice: 99,
        now,
        currentPeriodStart,
        currentPeriodEnd,
      });

      // (99 - 29) * 10 / 30 = 23.333... -> 23.33
      expect(amount).toBe(23.33);
    });

    it('is zero the instant the period starts and equals the full price diff at the very start', () => {
      const currentPeriodStart = new Date('2026-01-01T00:00:00.000Z');
      const currentPeriodEnd = new Date('2026-01-31T00:00:00.000Z');

      const amount = computeProration({
        oldPrice: 9,
        newPrice: 29,
        now: currentPeriodStart,
        currentPeriodStart,
        currentPeriodEnd,
      });

      // (29 - 9) * 30 / 30 = 20.00
      expect(amount).toBe(20);
    });

    it('clamps to zero once the period has already ended', () => {
      const currentPeriodStart = new Date('2026-01-01T00:00:00.000Z');
      const currentPeriodEnd = new Date('2026-01-31T00:00:00.000Z');
      const now = new Date('2026-02-15T00:00:00.000Z'); // well past period end

      const amount = computeProration({
        oldPrice: 9,
        newPrice: 29,
        now,
        currentPeriodStart,
        currentPeriodEnd,
      });

      expect(amount).toBe(0);
    });
  });

  describe('daysBetween / daysRemaining', () => {
    it('counts whole days between two instants', () => {
      expect(daysBetween(new Date('2026-01-01T00:00:00Z'), new Date('2026-01-31T00:00:00Z'))).toBe(
        30,
      );
    });

    it('never returns a negative number of days remaining', () => {
      const past = new Date('2026-01-01T00:00:00Z');
      const future = new Date('2025-01-01T00:00:00Z');
      expect(daysRemaining(past, future)).toBe(0);
    });
  });
});
