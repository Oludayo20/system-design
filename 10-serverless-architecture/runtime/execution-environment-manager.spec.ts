import * as path from 'path';
import { ExecutionEnvironmentManager } from './execution-environment-manager';

const FIXTURE_MODULE = path.join(__dirname, '__fixtures__', 'echo-handler');

describe('ExecutionEnvironmentManager', () => {
  it('is cold on the first invocation and warm on an immediate second one', async () => {
    const manager = new ExecutionEnvironmentManager({ warmTtlMs: 5_000, coldStartLatencyMs: 20 });
    manager.register('echo', FIXTURE_MODULE);

    const first = await manager.invoke('echo', { n: 1 });
    expect(first.cold).toBe(true);

    const second = await manager.invoke('echo', { n: 2 });
    expect(second.cold).toBe(false);
    expect(second.instanceId).toBe(first.instanceId);
  });

  it('injects a real, measurable delay on cold start', async () => {
    const manager = new ExecutionEnvironmentManager({ warmTtlMs: 5_000, coldStartLatencyMs: 150 });
    manager.register('echo', FIXTURE_MODULE);

    const wallClockStart = Date.now();
    const result = await manager.invoke('echo', {});
    const wallClockElapsed = Date.now() - wallClockStart;

    expect(result.cold).toBe(true);
    expect(wallClockElapsed).toBeGreaterThanOrEqual(150);
  });

  it('goes cold again once the warm TTL has expired', async () => {
    const manager = new ExecutionEnvironmentManager({ warmTtlMs: 100, coldStartLatencyMs: 10 });
    manager.register('echo', FIXTURE_MODULE);

    const first = await manager.invoke('echo', {});
    expect(first.cold).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 150));

    const second = await manager.invoke('echo', {});
    expect(second.cold).toBe(true);
  });

  it('bills in 100ms increments and accumulates per-function stats', async () => {
    const manager = new ExecutionEnvironmentManager({ warmTtlMs: 5_000, coldStartLatencyMs: 0 });
    manager.register('echo', FIXTURE_MODULE);

    const result = await manager.invoke('echo', {});
    expect(result.billedMs % 100).toBe(0);
    expect(result.billedMs).toBeGreaterThanOrEqual(100);

    const stats = manager.getStats()['echo'];
    expect(stats.invocations).toBe(1);
    expect(stats.coldStarts).toBe(1);
    expect(stats.warmStarts).toBe(0);
    expect(stats.totalBilledMs).toBe(result.billedMs);
  });

  it('spins up a separate instance per concurrent invocation when nothing is idle yet', async () => {
    const manager = new ExecutionEnvironmentManager({ warmTtlMs: 5_000, coldStartLatencyMs: 50 });
    manager.register('echo', FIXTURE_MODULE);

    const [a, b, c] = await Promise.all([
      manager.invoke('echo', { n: 1 }),
      manager.invoke('echo', { n: 2 }),
      manager.invoke('echo', { n: 3 }),
    ]);

    const instanceIds = new Set([a.instanceId, b.instanceId, c.instanceId]);
    expect(instanceIds.size).toBe(3);
    expect([a.cold, b.cold, c.cold].every(Boolean)).toBe(true);

    const stats = manager.getStats()['echo'];
    expect(stats.invocations).toBe(3);
    expect(stats.coldStarts).toBe(3);
  });

  it('the sweeper evicts idle instances past TTL, scaling to zero', async () => {
    const manager = new ExecutionEnvironmentManager({
      warmTtlMs: 50,
      coldStartLatencyMs: 5,
      sweepIntervalMs: 20,
    });
    manager.register('echo', FIXTURE_MODULE);

    await manager.invoke('echo', {});
    expect(manager.getStats()['echo'].warmInstances).toBe(1);

    manager.startSweeper();
    await new Promise((resolve) => setTimeout(resolve, 150));
    manager.stopSweeper();

    expect(manager.getStats()['echo'].warmInstances).toBe(0);
  });
});
