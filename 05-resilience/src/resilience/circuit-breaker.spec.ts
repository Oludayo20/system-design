import { CircuitBreaker } from './circuit-breaker';

describe('CircuitBreaker', () => {
  it('opens after consecutive failures reach the threshold', async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 5_000 });

    for (let i = 0; i < 3; i++) {
      await expect(
        breaker.execute(async () => {
          throw new Error('down');
        }),
      ).rejects.toThrow('down');
    }

    expect(breaker.getState()).toBe('OPEN');

    await expect(
      breaker.execute(async () => 'ok'),
    ).rejects.toThrow('Circuit breaker is OPEN');
  });

  it('closes again after a successful probe in HALF_OPEN', async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 1, resetTimeoutMs: 50 });

    await expect(
      breaker.execute(async () => {
        throw new Error('down');
      }),
    ).rejects.toThrow('down');

    await expect(
      breaker.execute(async () => 'ok'),
    ).rejects.toThrow('Circuit breaker is OPEN');

    await new Promise((resolve) => setTimeout(resolve, 60));

    const result = await breaker.execute(async () => 'recovered');
    expect(result).toBe('recovered');
    expect(breaker.getState()).toBe('CLOSED');
  });
});
