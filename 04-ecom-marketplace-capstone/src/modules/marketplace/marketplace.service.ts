import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { Category } from './entities/category.entity';
import { RedisService } from '../../infrastructure/redis/redis.service';

const PRODUCT_LIST_CACHE_KEY = 'marketplace:products:v1';
const PRODUCT_LIST_TTL_SECONDS = 60;

export interface ProductForOrder {
  id: string;
  name: string;
  priceCents: number;
  stock: number;
}

@Injectable()
export class MarketplaceService {
  private readonly logger = new Logger(MarketplaceService.name);

  constructor(
    @InjectRepository(Product, 'primary') private readonly products: Repository<Product>,
    @InjectRepository(Category, 'primary') private readonly categories: Repository<Category>,
    private readonly redis: RedisService,
  ) {}

  /**
   * Cache-aside: check Redis first, fall through to Postgres on a miss and
   * repopulate the cache. This is the doc's "/products -> Redis -> Product
   * Found -> Return" path. Mutations (order placement decrementing stock)
   * invalidate this key rather than trying to patch it in place.
   */
  async listProducts(): Promise<Product[]> {
    const cached = await this.redis.get<Product[]>(PRODUCT_LIST_CACHE_KEY);
    if (cached) {
      this.logger.debug('marketplace:products cache hit');
      return cached;
    }

    this.logger.debug('marketplace:products cache miss - querying Postgres');
    const products = await this.products.find({ relations: ['category'], order: { name: 'ASC' } });
    await this.redis.set(PRODUCT_LIST_CACHE_KEY, products, PRODUCT_LIST_TTL_SECONDS);
    return products;
  }

  async getProductById(id: string): Promise<Product> {
    const product = await this.products.findOne({ where: { id }, relations: ['category'] });
    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }
    return product;
  }

  async listCategories(): Promise<Category[]> {
    return this.categories.find({ order: { name: 'ASC' } });
  }

  /**
   * Narrow, read-only method for the Order module to validate a purchase
   * against. Deliberately returns only what Order needs (id/name/price/
   * stock), not the full Product entity - Order must never reach past this
   * method into Marketplace's table directly (same module-boundary rule as
   * project 01: modules talk through public methods or events, not by
   * poking each other's tables).
   */
  async getProductForOrder(productId: string): Promise<ProductForOrder> {
    const product = await this.products.findOne({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException(`Product ${productId} not found`);
    }
    return {
      id: product.id,
      name: product.name,
      priceCents: product.priceCents,
      stock: product.stock,
    };
  }

  /** Called by the Inventory worker in reaction to `order.created`. */
  async decrementStock(productId: string, quantity: number): Promise<void> {
    await this.products.decrement({ id: productId }, 'stock', quantity);
    await this.redis.del(PRODUCT_LIST_CACHE_KEY);
  }
}
