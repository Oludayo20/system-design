import { ExecutionEnvironmentManager } from '../runtime/execution-environment-manager';

/**
 * Schedule trigger, standing in for an EventBridge/CloudWatch Events cron rule (e.g.
 * `rate(1 day)`) invoking a Lambda directly with no HTTP request involved. Implemented with
 * `setInterval` rather than a cron library to keep the dependency footprint small — the mechanic
 * being taught (the platform invokes your function on a schedule, cold-starting it if it hasn't
 * run recently) doesn't require real cron expression parsing.
 */
export function startScheduleTrigger(
  manager: ExecutionEnvironmentManager,
  intervalMs: number,
): NodeJS.Timeout {
  // eslint-disable-next-line no-console
  console.log(
    `[schedule-trigger] dailySalesReport scheduled every ${intervalMs}ms (stands in for a cron/rate expression)`,
  );

  const timer = setInterval(() => {
    void manager
      .invoke('dailySalesReport', { scheduledAt: new Date().toISOString() })
      .then((result) => {
        // eslint-disable-next-line no-console
        console.log(
          `[schedule-trigger] fired — cold=${result.cold} duration=${result.durationMs}ms billed=${result.billedMs}ms`,
        );
      });
  }, intervalMs);

  timer.unref?.();
  return timer;
}
