import { delay } from '../../infrastructure/delay.js';

/**
 * Catalog module - doc.md: "Products, Categories, Search, Product Images."
 * Demonstrates the Redis-vs-PostgreSQL flow: "Instead of PostgreSQL -> Redis
 * -> Product Found -> Return. Faster."
 */
export function createCatalogModule({ db, cache }) {
  async function seed() {
    await db.insert('products', { id: 1, name: 'Laptop', price: 1500 });
    await db.insert('products', { id: 2, name: 'Phone', price: 800 });
    await db.insert('products', { id: 3, name: 'Headphones', price: 150 });
  }

  async function getProduct(id) {
    const cacheKey = `product:${id}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log(`[Catalog] cache HIT for product ${id} (Redis) - PostgreSQL was not touched`);
      return cached;
    }

    console.log(`[Catalog] cache MISS for product ${id} - querying PostgreSQL...`);
    await delay(100); // simulate a heavier DB query
    const product = await db.find('products', (p) => p.id === id);
    if (product) cache.set(`product:${id}`, product, 60_000);
    return product;
  }

  function listProducts() {
    return db.findAll('products');
  }

  return { seed, getProduct, listProducts };
}
