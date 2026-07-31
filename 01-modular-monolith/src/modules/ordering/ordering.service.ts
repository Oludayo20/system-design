import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { EventBus } from '../../infrastructure/rabbitmq/event-bus.service';
import { RoutingKeys } from '../../infrastructure/rabbitmq/rabbitmq.constants';
import { BasketService } from '../basket/basket.service';
import { Order, OrderStatus } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderCreatedEvent } from './events/order-created.event';

export interface PlaceOrderResult {
  success: true;
  orderId: string;
}

@Injectable()
export class OrderingService {
  private readonly logger = new Logger(OrderingService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    private readonly basketService: BasketService,
    private readonly eventBus: EventBus,
  ) {}

  /**
   * Snapshot the basket into an order inside one DB transaction, commit it, and only THEN
   * publish `order.created`. Publishing before commit risks a consumer (Inventory) acting on an
   * order that a later rollback erases; publishing after commit means "the event exists" is
   * always a true statement about durable state. The event bus call itself is fire-and-forget —
   * we never await Inventory/Notifications before responding to the customer.
   */
  async placeOrder(userId: string): Promise<PlaceOrderResult> {
    const basket = await this.basketService.assertNotEmpty(userId);

    const order = await this.dataSource.transaction(async (manager) => {
      const newOrder = manager.create(Order, {
        userId,
        status: OrderStatus.PLACED,
        total: basket.total.toFixed(2),
        items: basket.items.map((line) =>
          manager.create(OrderItem, {
            productId: line.productId,
            productName: line.name,
            unitPrice: line.unitPrice.toFixed(2),
            quantity: line.quantity,
            lineTotal: line.lineTotal.toFixed(2),
          }),
        ),
      });

      return manager.save(newOrder);
    });

    await this.basketService.clear(userId);

    const event: OrderCreatedEvent = {
      orderId: order.id,
      userId: order.userId,
      total: Number(order.total),
      items: order.items.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
      })),
    };

    // Fire-and-forget: intentionally not awaited by the HTTP handler's response path.
    // The publish call itself resolves once RabbitMQ has ack'd receipt, not once
    // Inventory/Notifications have finished reacting to it.
    void this.eventBus
      .publish(RoutingKeys.ORDER_CREATED, event)
      .catch((error) =>
        this.logger.error(`Failed to publish order.created for ${order.id}`, error),
      );

    this.logger.log(`Order ${order.id} placed by user ${userId}, total ${order.total}`);
    return { success: true, orderId: order.id };
  }

  async getOrder(userId: string, orderId: string): Promise<Order> {
    const order = await this.orders.findOne({ where: { id: orderId }, relations: ['items'] });
    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }
    if (order.userId !== userId) {
      throw new ForbiddenException('This order does not belong to you');
    }
    return order;
  }

  async listOrders(userId: string): Promise<Order[]> {
    return this.orders.find({
      where: { userId },
      relations: ['items'],
      order: { createdAt: 'DESC' },
    });
  }

  async cancelOrder(userId: string, orderId: string): Promise<Order> {
    const order = await this.getOrder(userId, orderId);
    if (order.status === OrderStatus.CANCELLED) {
      return order;
    }

    order.status = OrderStatus.CANCELLED;
    const saved = await this.orders.save(order);

    void this.eventBus
      .publish(RoutingKeys.ORDER_CANCELLED, { orderId: saved.id, userId })
      .catch((error) =>
        this.logger.error(`Failed to publish order.cancelled for ${saved.id}`, error),
      );

    return saved;
  }
}
