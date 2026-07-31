import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CatalogService } from '../catalog/catalog.service';
import { BasketView } from './basket.types';
import { AddItemDto } from './dto/add-item.dto';
import { CartItem } from './entities/cart-item.entity';

@Injectable()
export class BasketService {
  constructor(
    @InjectRepository(CartItem) private readonly cartItems: Repository<CartItem>,
    // Basket is only allowed to reach Catalog through its public service — never through a
    // Product repository. This is the concrete enforcement of "public interfaces, not tables".
    private readonly catalogService: CatalogService,
  ) {}

  async addItem(userId: string, dto: AddItemDto): Promise<BasketView> {
    // Validates the product exists (and is priceable) before it's allowed into the basket.
    await this.catalogService.getProductForOrder(dto.productId);

    const existing = await this.cartItems.findOne({
      where: { userId, productId: dto.productId },
    });

    if (existing) {
      existing.quantity += dto.quantity;
      await this.cartItems.save(existing);
    } else {
      await this.cartItems.save(
        this.cartItems.create({ userId, productId: dto.productId, quantity: dto.quantity }),
      );
    }

    return this.getBasket(userId);
  }

  async removeItem(userId: string, productId: string): Promise<BasketView> {
    await this.cartItems.delete({ userId, productId });
    return this.getBasket(userId);
  }

  async getBasket(userId: string): Promise<BasketView> {
    const items = await this.cartItems.find({ where: { userId } });

    const lines = await Promise.all(
      items.map(async (item) => {
        const product = await this.catalogService.getProductForOrder(item.productId);
        return {
          productId: product.id,
          name: product.name,
          unitPrice: product.price,
          quantity: item.quantity,
          lineTotal: Number((product.price * item.quantity).toFixed(2)),
        };
      }),
    );

    const total = Number(lines.reduce((sum, line) => sum + line.lineTotal, 0).toFixed(2));
    return { userId, items: lines, total };
  }

  async clear(userId: string): Promise<void> {
    await this.cartItems.delete({ userId });
  }

  async assertNotEmpty(userId: string): Promise<BasketView> {
    const basket = await this.getBasket(userId);
    if (basket.items.length === 0) {
      throw new BadRequestException('Basket is empty');
    }
    return basket;
  }
}
