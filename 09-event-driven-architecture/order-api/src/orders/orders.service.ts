import { randomUUID } from 'node:crypto';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { RabbitmqService } from '../common/rabbitmq/rabbitmq.service';
import { GROCERY_EVENTS_EXCHANGE, ORDER_PLACED_ROUTING_KEY } from '../common/rabbitmq/topology';
import { CreateOrderDto } from './dto/create-order.dto';
import { Order } from './entities/order.entity';
import { OrderPlacedEvent } from './order-placed.event';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    private readonly dataSource: DataSource,
    private readonly rabbitmq: RabbitmqService,
  ) {}

  /**
   * Publish-after-commit, for real.
   *
   * The DB write happens inside its own transaction (`dataSource.transaction`). The publish
   * call below only runs after that `await` resolves — i.e. after Postgres has durably
   * committed the order row. If we published first (or inside the transaction, before commit),
   * a consumer could race ahead of the write: inventory-consumer could look up an order that
   * a GET /orders/:id — or a slower replica — can't see yet. Publishing after commit guarantees
   * every consumer that reacts to `order.placed` is reacting to a fact that is already true and
   * durable, not a promise that it will be.
   *
   * This is the one ordering guarantee FreshCart actually needs (see README "Ordering"). It does
   * NOT need order.placed to be ordered relative to other *event types*, because there aren't
   * any upstream events it depends on here — order.placed is the first domino, not a link in a
   * chain of causally-dependent events.
   */
  async placeOrder(dto: CreateOrderDto): Promise<Order> {
    const totalAmount = dto.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

    const order = await this.dataSource.transaction(async (manager) => {
      return manager.save(
        Order,
        manager.create(Order, {
          customerId: dto.customerId,
          items: dto.items,
          totalAmount: totalAmount.toFixed(2),
          status: 'placed',
        }),
      );
    });
    // <-- Transaction committed. Everything below happens only because the line above resolved.

    const event: OrderPlacedEvent = {
      eventId: randomUUID(),
      eventType: 'order.placed',
      occurredAt: new Date().toISOString(),
      payload: {
        orderId: order.id,
        customerId: order.customerId,
        items: order.items,
        totalAmount: Number(order.totalAmount),
      },
    };

    await this.rabbitmq.publish(GROCERY_EVENTS_EXCHANGE, ORDER_PLACED_ROUTING_KEY, event);
    this.logger.log(
      `Order ${order.id} committed and order.placed published (eventId=${event.eventId}). ` +
        'order-api does not know, and will never know, which consumers (if any) act on it.',
    );

    return order;
  }

  async getOrder(id: string): Promise<Order> {
    const order = await this.orders.findOneBy({ id });
    if (!order) {
      throw new NotFoundException(`Order ${id} not found`);
    }
    return order;
  }
}
