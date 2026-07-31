import { delay } from '../../infrastructure/delay.js';

/**
 * doc.md: "Inventory Module -> Reduce Stock" - a RabbitMQ-style competing
 * consumer on the order queue.
 */
export function registerInventoryWorker(orderQueue) {
  orderQueue.registerWorker('inventory-worker', async (payload) => {
    await delay(300);
    console.log(`  [Inventory Worker] reduced stock for order #${payload.orderId}`);
  });
}
