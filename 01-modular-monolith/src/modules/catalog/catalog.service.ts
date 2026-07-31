import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { ProductForOrder } from './catalog.types';
import { Product } from './entities/product.entity';

const PRODUCT_CACHE_TTL_SECONDS = 300;
const productCacheKey = (id: string) => `catalog:product:${id}`;

@Injectable()
export class CatalogService {
  private readonly logger = new Logger(CatalogService.name);

  constructor(
    @InjectRepository(Product) private readonly products: Repository<Product>,
    private readonly redisService: RedisService,
  ) {}

  async listProducts(): Promise<Product[]> {
    return this.products.find({ order: { createdAt: 'DESC' } });
  }

  /**
   * Cache-aside on the hot product-read path: check Redis first, fall back to Postgres on a
   * miss, then populate the cache with a TTL so the next read is served without hitting the DB.
   */
  async getProduct(id: string): Promise<Product> {
    const cacheKey = productCacheKey(id);
    const cached = await this.redisService.getJson<Product>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for product ${id}`);
      return cached;
    }

    this.logger.debug(`Cache miss for product ${id}, reading Postgres`);
    const product = await this.products.findOne({ where: { id } });
    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }

    await this.redisService.setJson(cacheKey, product, PRODUCT_CACHE_TTL_SECONDS);
    return product;
  }

  /**
   * Narrow, read-only interface for other modules (Basket, Ordering). Deliberately returns only
   * what a caller needs to price a cart / snapshot an order line item, never the full entity.
   */
  async getProductForOrder(id: string): Promise<ProductForOrder> {
    const product = await this.getProduct(id);
    return {
      id: product.id,
      name: product.name,
      price: Number(product.price),
      stock: product.stock,
    };
  }

  /**
   * Called only by the Inventory consumer after `order.created`. Bypasses the cache-aside read
   * path on purpose (this is a write) and invalidates the cached copy so the next read reflects
   * the new stock level instead of serving a stale cached value.
   */
  async decrementStock(id: string, quantity: number): Promise<void> {
    const result = await this.products
      .createQueryBuilder()
      .update(Product)
      .set({ stock: () => 'stock - :quantity' })
      .where('id = :id AND stock >= :quantity', { id, quantity })
      .setParameters({ quantity })
      .execute();

    if (result.affected === 0) {
      this.logger.warn(
        `Could not decrement stock for product ${id} by ${quantity} (insufficient stock?)`,
      );
      return;
    }

    await this.redisService.del(productCacheKey(id));
    this.logger.log(`Decremented stock for product ${id} by ${quantity}`);
  }
}
