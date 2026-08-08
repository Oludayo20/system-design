/**
 * Pure billing-period math. No framework imports, no I/O — every function here is a plain
 * function of its inputs, which is what makes it trivial to unit test (see billing-cycle.spec.ts).
 */

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Fixed-length billing periods keep proration math simple and deterministic. */
export const BILLING_PERIOD_DAYS = 30;

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

/** Whole days between two instants, rounded to the nearest day. */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
}

/** Days left in the billing period, clamped at zero once the period has ended. */
export function daysRemaining(now: Date, currentPeriodEnd: Date): number {
  return Math.max(0, daysBetween(now, currentPeriodEnd));
}

export function startNewBillingPeriod(now: Date): {
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
} {
  return { currentPeriodStart: now, currentPeriodEnd: addDays(now, BILLING_PERIOD_DAYS) };
}

export interface ProrationInput {
  oldPrice: number;
  newPrice: number;
  now: Date;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
}

/**
 * Upgrade proration: (newPrice - oldPrice) * daysRemaining / daysInPeriod, rounded to 2 decimals.
 * Positive for upgrades (a bigger, more expensive plan) since newPrice > oldPrice.
 */
export function computeProration(input: ProrationInput): number {
  const daysInPeriod = Math.max(1, daysBetween(input.currentPeriodStart, input.currentPeriodEnd));
  const remaining = daysRemaining(input.now, input.currentPeriodEnd);
  const rawAmount = ((input.newPrice - input.oldPrice) * remaining) / daysInPeriod;
  return Math.round(rawAmount * 100) / 100;
}
