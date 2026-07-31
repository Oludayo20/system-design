import { delay } from '../../infrastructure/delay.js';

/**
 * doc.md: "Kafka focuses on: Broadcasting events ... Order Created -> Kafka
 * -> Inventory -> Analytics -> Fraud Detection -> Recommendation Engine.
 * Many services can consume the same event independently."
 *
 * Both consumer groups below receive every event - they do not compete for it
 * the way queue workers do.
 */
export function registerAnalyticsConsumers(saleTopic) {
  saleTopic.subscribe('analytics-service', async (payload) => {
    await delay(150);
    console.log(`  [Analytics] recorded sale of $${payload.total} for order #${payload.orderId}`);
  });

  saleTopic.subscribe('fraud-detection-service', async (payload) => {
    await delay(220);
    console.log(`  [Fraud Detection] scanned order #${payload.orderId} - looks fine`);
  });
}
