import { Injectable, Logger } from '@nestjs/common';
import { OrderPlacedEvent } from '../order-placed.event';
import { SalesStats } from './stats.model';

/**
 * In-memory running counters — good enough for a teaching demo of "analytics reacts
 * independently to order.placed." A production analytics-consumer would write to a proper
 * time-series/warehouse store instead.
 */
@Injectable()
export class StatsService {
  private readonly logger = new Logger(StatsService.name);
  private ordersToday = 0;
  private revenueToday = 0;
  private lastOrderId: string | null = null;
  private lastUpdatedAt: string | null = null;

  async recordOrder(event: OrderPlacedEvent): Promise<void> {
    this.ordersToday += 1;
    this.revenueToday += event.payload.totalAmount;
    this.lastOrderId = event.payload.orderId;
    this.lastUpdatedAt = new Date().toISOString();
    this.logger.log(
      `order.placed (orderId=${event.payload.orderId}, eventId=${event.eventId}): ` +
        `ordersToday=${this.ordersToday}, revenueToday=${this.revenueToday.toFixed(2)}`,
    );
  }

  getStats(): SalesStats {
    return {
      ordersToday: this.ordersToday,
      revenueToday: Number(this.revenueToday.toFixed(2)),
      lastOrderId: this.lastOrderId,
      lastUpdatedAt: this.lastUpdatedAt,
    };
  }
}
