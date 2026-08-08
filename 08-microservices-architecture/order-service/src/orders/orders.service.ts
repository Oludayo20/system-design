import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from './entities/order.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { CatalogClientService } from '../catalog/catalog-client.service';
import { NotificationClientService } from '../notification/notification-client.service';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    private readonly catalogClient: CatalogClientService,
    private readonly notificationClient: NotificationClientService,
  ) {}

  /**
   * The whole point of this service, laid out step by step:
   *   1. Ask catalog-service (HTTP) for price + stock, and have it
   *      atomically decrement stock. This can fail the whole request
   *      (404 unknown book, 409 out of stock, 502 catalog unreachable) -
   *      that's correct, an order without a real reservation isn't valid.
   *   2. Persist the order in order-db - the ONLY database this service
   *      writes to.
   *   3. Fire-and-forget notify notification-service. This step can fail
   *      silently; see NotificationClientService for why.
   */
  async placeOrder(userId: string, dto: CreateOrderDto, authorizationHeader: string): Promise<Order> {
    const reservation = await this.catalogClient.reserveStock(
      dto.bookId,
      dto.quantity,
      authorizationHeader,
    );

    const order = await this.orders.save(
      this.orders.create({
        userId,
        bookId: dto.bookId,
        quantity: dto.quantity,
        unitPriceCents: reservation.unitPriceCents,
        totalCents: reservation.totalCents,
        status: 'confirmed',
      }),
    );

    this.logger.log(`Order ${order.id} confirmed for user ${userId} (book ${dto.bookId})`);

    // Not awaited into the response path in spirit - we await it here only
    // to log the outcome, but placeOrder's own success does not depend on
    // it (see NotificationClientService: every failure mode is swallowed).
    await this.notificationClient.notifyOrderCreated(order.id, userId, dto.bookId, dto.quantity);

    return order;
  }

  findAllForUser(userId: string): Promise<Order[]> {
    return this.orders.find({ where: { userId }, order: { createdAt: 'DESC' } });
  }

  async findOneForUser(id: string, userId: string): Promise<Order> {
    const order = await this.orders.findOne({ where: { id, userId } });
    if (!order) {
      throw new NotFoundException(`Order ${id} not found`);
    }
    return order;
  }
}
