import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Order, OrderStatus } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { MarketplaceService } from '../marketplace/marketplace.service';
import { EventBusService } from '../../infrastructure/rabbitmq/event-bus.service';
import { OrderCreatedEvent, ROUTING_KEYS } from '../../infrastructure/rabbitmq/constants';

export interface CreateOrderResult {
  success: true;
  orderId: string;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectDataSource('primary') private readonly primaryDataSource: DataSource,
    private readonly marketplaceService: MarketplaceService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * The doc.md flow, made real: validate -> persist in a transaction ->
   * publish `order.created` -> return immediately. Nothing here awaits the
   * Email/Inventory/Analytics/Wallet workers - they are separate consumers
   * on separate queues, running in parallel, entirely decoupled from this
   * request/response cycle. The only module boundary crossed synchronously
   * is the read-only `MarketplaceService.getProductForOrder` call, needed
   * to validate the order before money/stock are ever touched.
   */
  async createOrder(userId: string, dto: CreateOrderDto): Promise<CreateOrderResult> {
    const validatedItems: Array<{
      productId: string;
      productName: string;
      quantity: number;
      unitPriceCents: number;
    }> = [];

    for (const item of dto.items) {
      const product = await this.marketplaceService.getProductForOrder(item.productId);
      if (product.stock < item.quantity) {
        throw new BadRequestException(
          `Insufficient stock for "${product.name}": requested ${item.quantity}, available ${product.stock}`,
        );
      }
      validatedItems.push({
        productId: product.id,
        productName: product.name,
        quantity: item.quantity,
        unitPriceCents: product.priceCents,
      });
    }

    const totalCents = validatedItems.reduce(
      (sum, item) => sum + item.unitPriceCents * item.quantity,
      0,
    );

    const order = await this.primaryDataSource.transaction(async (manager) => {
      const newOrder = manager.create(Order, {
        userId,
        status: OrderStatus.PENDING,
        totalCents,
        items: validatedItems.map((item) =>
          manager.create(OrderItem, {
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            unitPriceCents: item.unitPriceCents,
          }),
        ),
      });
      return manager.save(Order, newOrder);
    });

    this.logger.log(`Order ${order.id} persisted for user ${userId} - publishing order.created`);

    const event: OrderCreatedEvent = {
      orderId: order.id,
      userId,
      totalCents: order.totalCents,
      items: validatedItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
      })),
      createdAt: order.createdAt.toISOString(),
    };
    await this.eventBus.publish(
      ROUTING_KEYS.ORDER_CREATED,
      event as unknown as Record<string, unknown>,
    );

    return { success: true, orderId: order.id };
  }
}
