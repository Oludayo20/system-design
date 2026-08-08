import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderPlacedEvent } from '../order-placed.event';
import { StockItem } from './entities/stock-item.entity';

/** Starting catalog. Seeded once on boot so GET /stock has something to show before any order. */
const CATALOG_SEED: Array<{ sku: string; name: string; quantity: number }> = [
  { sku: 'milk-1l', name: 'Whole Milk 1L', quantity: 100 },
  { sku: 'bread-1', name: 'Sliced White Bread', quantity: 100 },
  { sku: 'eggs-12', name: 'Eggs (12-pack)', quantity: 100 },
  { sku: 'rice-5kg', name: 'Rice 5kg Bag', quantity: 100 },
  { sku: 'banana-1kg', name: 'Bananas 1kg', quantity: 100 },
];

@Injectable()
export class StockService {
  private readonly logger = new Logger(StockService.name);

  constructor(@InjectRepository(StockItem) private readonly stockItems: Repository<StockItem>) {}

  async seedIfEmpty(): Promise<void> {
    const count = await this.stockItems.count();
    if (count > 0) {
      return;
    }
    await this.stockItems.save(this.stockItems.create(CATALOG_SEED));
    this.logger.log(`Seeded ${CATALOG_SEED.length} stock items`);
  }

  async getAll(): Promise<StockItem[]> {
    return this.stockItems.find({ order: { sku: 'ASC' } });
  }

  /**
   * React to order.placed by decrementing stock for every line item. This has nothing to do
   * with notification-consumer, analytics-consumer, or loyalty-consumer succeeding or failing —
   * each consumer reacts to its own copy of the event independently. If notification-consumer's
   * queue backs up or its process crashes, stock still gets decremented here; there is no
   * cross-consumer ordering requirement between them (see README "Ordering").
   */
  async applyOrder(event: OrderPlacedEvent): Promise<void> {
    for (const item of event.payload.items) {
      let stock = await this.stockItems.findOneBy({ sku: item.sku });
      if (!stock) {
        // Unknown SKU: create it on the fly rather than dropping the event, so the demo never
        // silently loses an order line just because it wasn't in the seed catalog.
        stock = this.stockItems.create({ sku: item.sku, name: item.name, quantity: 100 });
      }
      const nextQuantity = stock.quantity - item.quantity;
      if (nextQuantity < 0) {
        this.logger.warn(
          `SKU ${item.sku} would go negative (${stock.quantity} - ${item.quantity}); clamping ` +
            'to 0. A production system would route this to a backorder/compensation flow.',
        );
      }
      stock.quantity = Math.max(0, nextQuantity);
      await this.stockItems.save(stock);
      this.logger.log(
        `order.placed (orderId=${event.payload.orderId}, eventId=${event.eventId}): decremented ` +
          `${item.sku} by ${item.quantity} -> ${stock.quantity} remaining`,
      );
    }
  }
}
