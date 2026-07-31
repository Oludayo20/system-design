import { delay } from '../../infrastructure/delay.js';

/**
 * doc.md: "Send Email" (~5s in the doc's example, scaled down here for a
 * fast demo) and "Send Push". Runs as a RabbitMQ-style competing consumer.
 */
export function registerNotificationWorker(orderQueue) {
  orderQueue.registerWorker('notification-worker', async (payload) => {
    await delay(700);
    console.log(`  [Notification Worker] sent receipt email + push notification for order #${payload.orderId}`);
  });
}
