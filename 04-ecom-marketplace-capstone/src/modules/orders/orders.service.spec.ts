import { BadRequestException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { Order, OrderStatus } from './entities/order.entity';
import { ROUTING_KEYS } from '../../infrastructure/rabbitmq/constants';

/**
 * Proves the doc.md order flow without touching Postgres/RabbitMQ: persist
 * the order, THEN publish `order.created`, THEN return - with nothing in
 * between awaiting a worker (there's nothing to await; the four workers are
 * separate queue consumers entirely outside this call stack).
 */
describe('OrdersService', () => {
  const userId = 'user-123';
  const productId = 'a1b2c3d4-e5f6-4789-a012-3456789abcde';

  const savedOrder: Order = {
    id: 'order-999',
    userId,
    status: OrderStatus.PENDING,
    totalCents: 2000,
    items: [],
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
  };

  function buildService() {
    const calls: string[] = [];

    const manager = {
      create: jest.fn((_entityClass: unknown, data: unknown) => data),
      save: jest.fn(async (entityClass: unknown) => {
        calls.push('persist');
        if (entityClass === Order) return savedOrder;
        return {};
      }),
    };

    const dataSource = {
      transaction: jest.fn(async (cb: (manager: unknown) => Promise<unknown>) => cb(manager)),
    };

    const marketplaceService = {
      getProductForOrder: jest.fn().mockResolvedValue({
        id: productId,
        name: 'Wireless Earbuds',
        priceCents: 1000,
        stock: 10,
      }),
      decrementStock: jest.fn(),
    };

    const eventBus = {
      publish: jest.fn(async () => {
        calls.push('publish');
      }),
    };

    const service = new OrdersService(
      dataSource as any,
      marketplaceService as any,
      eventBus as any,
    );
    return { service, dataSource, marketplaceService, eventBus, calls };
  }

  it('persists the order before publishing order.created, and returns without waiting on workers', async () => {
    const { service, dataSource, eventBus, calls } = buildService();

    const result = await service.createOrder(userId, { items: [{ productId, quantity: 2 }] });

    expect(result).toEqual({ success: true, orderId: savedOrder.id });
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(eventBus.publish).toHaveBeenCalledTimes(1);
    expect(eventBus.publish).toHaveBeenCalledWith(
      ROUTING_KEYS.ORDER_CREATED,
      expect.objectContaining({
        orderId: savedOrder.id,
        userId,
        totalCents: savedOrder.totalCents,
      }),
    );
    // persist-then-publish, not the other way around
    expect(calls).toEqual(['persist', 'publish']);
  });

  it('validates against Marketplace via the narrow getProductForOrder method, never touching Product rows directly', async () => {
    const { service, marketplaceService } = buildService();

    await service.createOrder(userId, { items: [{ productId, quantity: 3 }] });

    expect(marketplaceService.getProductForOrder).toHaveBeenCalledWith(productId);
    // OrdersService must never call Marketplace's stock-mutating method -
    // that belongs solely to the Inventory worker, reacting to the event.
    expect(marketplaceService.decrementStock).not.toHaveBeenCalled();
  });

  it('rejects the order before any persistence or publish when stock is insufficient', async () => {
    const { service, dataSource, eventBus, marketplaceService } = buildService();
    marketplaceService.getProductForOrder.mockResolvedValue({
      id: productId,
      name: 'Wireless Earbuds',
      priceCents: 1000,
      stock: 1,
    });

    await expect(
      service.createOrder(userId, { items: [{ productId, quantity: 5 }] }),
    ).rejects.toThrow(BadRequestException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
  });
});
