/**
 * Test-only fixture. Not a real function under functions/, not compiled into the Docker image
 * (excluded via tsconfig.build.json). Exists purely so execution-environment-manager.spec.ts can
 * register a real module and prove cold-start module re-initialization with `require.cache`
 * eviction actually happens, without spinning up Express or RabbitMQ.
 */

// Module-level "cold init" work — captured once per fresh require(), reset to a new value only
// when the manager evicts this module from require.cache and re-requires it (i.e. on a cold
// start). Unchanged across warm reuse.
export const loadedAt = Date.now();

let invocationsSinceLoad = 0;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function handler(
  event: any,
  context: any,
): Promise<{ statusCode: number; body: string }> {
  invocationsSinceLoad += 1;
  return {
    statusCode: 200,
    body: JSON.stringify({ loadedAt, invocationsSinceLoad, event, requestId: context.requestId }),
  };
}
