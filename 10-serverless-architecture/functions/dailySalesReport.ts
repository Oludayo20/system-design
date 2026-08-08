import { summarizeOrders } from '../store/order-store';
import { FunctionContext, FunctionResponse } from '../runtime/types';

/**
 * Schedule (cron-style) triggered function. Fired on an interval by the schedule trigger
 * adapter, not by any HTTP request — stands in for an EventBridge scheduled rule invoking a
 * Lambda directly.
 */
// eslint-disable-next-line no-console
console.log('[dailySalesReport] cold init: report generator handler module loaded');

interface ScheduleEvent {
  scheduledAt: string;
}

export async function handler(
  event: ScheduleEvent,
  _context: FunctionContext,
): Promise<FunctionResponse> {
  const { ordersProcessed, totalRevenue } = summarizeOrders();

  const report = {
    generatedAt: new Date().toISOString(),
    scheduledAt: event.scheduledAt,
    ordersProcessed,
    totalRevenue,
  };

  // eslint-disable-next-line no-console
  console.log(`[dailySalesReport] report generated: ${JSON.stringify(report)}`);

  return { statusCode: 200, body: JSON.stringify(report) };
}
