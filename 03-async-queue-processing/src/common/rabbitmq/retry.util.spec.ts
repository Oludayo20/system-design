import { MAX_DELIVERY_ATTEMPTS } from './topology';
import { nextAttempt, shouldDeadLetter } from './retry.util';

describe('shouldDeadLetter', () => {
  it('does not dead-letter while attempts remain below the max', () => {
    expect(shouldDeadLetter(1, 3)).toBe(false);
    expect(shouldDeadLetter(2, 3)).toBe(false);
  });

  it('dead-letters once attempts reach the max', () => {
    expect(shouldDeadLetter(3, 3)).toBe(true);
  });

  it('dead-letters if somehow already past the max', () => {
    expect(shouldDeadLetter(4, 3)).toBe(true);
  });

  it('defaults to the topology-wide MAX_DELIVERY_ATTEMPTS when no max is given', () => {
    expect(shouldDeadLetter(MAX_DELIVERY_ATTEMPTS - 1)).toBe(false);
    expect(shouldDeadLetter(MAX_DELIVERY_ATTEMPTS)).toBe(true);
  });
});

describe('nextAttempt', () => {
  it('starts at 1 when there is no retry-count header yet', () => {
    expect(nextAttempt(undefined)).toBe(1);
    expect(nextAttempt({})).toBe(1);
  });

  it('increments the existing x-retry-count header', () => {
    expect(nextAttempt({ 'x-retry-count': 1 })).toBe(2);
    expect(nextAttempt({ 'x-retry-count': 2 })).toBe(3);
  });

  it('ignores a non-numeric header instead of propagating garbage', () => {
    expect(nextAttempt({ 'x-retry-count': 'not-a-number' })).toBe(1);
  });
});
