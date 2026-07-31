/**
 * Fires many concurrent POST /rides requests and reports latency percentiles. The point of
 * the demo: because the producer only inserts a row and publishes to RabbitMQ — never awaits
 * the email/analytics/loyalty workers — latency should stay flat whether 1 worker or 20
 * workers are running, and whether 10 or 100,000 rides are in flight.
 */
async function main() {
  const baseUrl = process.env.LOAD_TEST_BASE_URL ?? 'http://localhost:3000';
  const totalRequests = Number(process.env.LOAD_TEST_REQUESTS ?? 500);
  const concurrency = Number(process.env.LOAD_TEST_CONCURRENCY ?? 500);

  console.log(
    `[load-test] firing ${totalRequests} POST /rides requests (concurrency=${concurrency}) at ${baseUrl}`,
  );

  const startedAt = Date.now();
  let completed = 0;
  let failed = 0;
  const latencies: number[] = [];

  async function fireOne(i: number) {
    const body = {
      riderId: `rider-${i}`,
      driverId: `driver-${i % 50}`,
      fare: Number((Math.random() * 40 + 5).toFixed(2)),
      pickupLocation: 'Ikeja, Lagos',
      dropoffLocation: 'Lekki, Lagos',
    };

    const startedRequestAt = Date.now();
    try {
      const res = await fetch(`${baseUrl}/rides`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      latencies.push(Date.now() - startedRequestAt);
      if (!res.ok) {
        failed++;
      }
    } catch {
      failed++;
    } finally {
      completed++;
    }
  }

  const queue = Array.from({ length: totalRequests }, (_, i) => i);
  async function worker() {
    while (queue.length > 0) {
      const i = queue.pop();
      if (i === undefined) break;
      await fireOne(i);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, totalRequests) }, () => worker()));

  const durationMs = Date.now() - startedAt;
  latencies.sort((a, b) => a - b);
  const percentile = (p: number) =>
    latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * p))] ?? 0;

  console.log(`[load-test] done in ${durationMs}ms — completed=${completed} failed=${failed}`);
  console.log(
    `[load-test] latency p50=${percentile(0.5)}ms p95=${percentile(0.95)}ms p99=${percentile(0.99)}ms`,
  );
  console.log(
    '[load-test] flat latency here is the point: POST /rides only inserts a row + publishes, it never waits on workers.',
  );
}

main().catch((err) => {
  console.error('[load-test] fatal error', err);
  process.exit(1);
});
