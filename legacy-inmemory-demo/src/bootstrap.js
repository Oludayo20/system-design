import { Database } from './infrastructure/database.js';
import { Cache } from './infrastructure/cache.js';
import { Queue, Topic } from './infrastructure/eventBus.js';

import { createIdentityModule } from './modules/identity/identity.module.js';
import { createCatalogModule } from './modules/catalog/catalog.module.js';
import { createBasketModule } from './modules/basket/basket.module.js';
import { createOrderingModule } from './modules/ordering/ordering.module.js';
import { registerInventoryWorker } from './modules/inventory/inventory.worker.js';
import { registerNotificationWorker } from './modules/notification/notification.worker.js';
import { registerAnalyticsConsumers } from './modules/analytics/analytics.worker.js';

/**
 * This is the "one repository, one deployment" from doc.md - every module
 * below is wired into a single process, but each one only exposes a small
 * public interface to the others (e.g. `basket` calls `catalog.listProducts()`,
 * never `db.table('products')` directly).
 */
export async function bootstrap() {
  // One logical PostgreSQL database, shared by all modules (doc.md: "Single Codebase").
  const db = new Database('postgres');
  // One shared Redis-like cache.
  const cache = new Cache();

  // doc.md: "RabbitMQ at the Bottom" - the order queue (task distribution).
  const orderQueue = new Queue('orders');
  // doc.md: Kafka-style topic - broadcast to every interested service.
  const saleTopic = new Topic('sales');

  const identity = createIdentityModule({ db });
  const catalog = createCatalogModule({ db, cache });
  const basket = createBasketModule({ db, catalog });
  const ordering = createOrderingModule({ db, basket, orderQueue, saleTopic });

  await catalog.seed();

  // Background consumers - they run independently of the API request/response cycle.
  registerInventoryWorker(orderQueue);
  registerNotificationWorker(orderQueue);
  registerAnalyticsConsumers(saleTopic);

  return { db, cache, orderQueue, saleTopic, identity, catalog, basket, ordering };
}
