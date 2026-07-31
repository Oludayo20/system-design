import { Test } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { EventBus } from '../../infrastructure/rabbitmq/event-bus.service';
import { RoutingKeys } from '../../infrastructure/rabbitmq/rabbitmq.constants';
import { BasketService } from '../basket/basket.service';
import { Order, OrderStatus } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderingService } from './ordering.service';

describe('OrderingService', () => {
  let orderingService: OrderingService;
  let eventBus: { publish: jest.Mock };
  let basketService: { assertNotEmpty: jest.Mock; clear: jest.Mock };
  let ordersRepository: { findOne: jest.Mock; find: jest.Mock };
  let dataSource: { transaction: jest.Mock };

  const savedOrder: Order = {
    id: 'order-1',
    userId: 'user-1',
    status: OrderStatus.PLACED,
    total: '89.98',
    items: [
      {
        id: 'item-1',
        orderId: 'order-1',
        productId: 'product-1',
        productName: 'Wireless Mouse',
        unitPrice: '39.99',
        quantity: 1,
        lineTotal: '39.99',
      } as OrderItem,
      {
        id: 'item-2',
        orderId: 'order-1',
        productId: 'product-2',
        productName: 'Mechanical Keyboard',
        unitPrice: '49.99',
        quantity: 1,
        lineTotal: '49.99',
      } as OrderItem,
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
    basketService = {
      assertNotEmpty: jest.fn().mockResolvedValue({
        userId: 'user-1',
        total: 89.98,
        items: [
          {
            productId: 'product-1',
            name: 'Wireless Mouse',
            unitPrice: 39.99,
            quantity: 1,
            lineTotal: 39.99,
          },
          {
            productId: 'product-2',
            name: 'Mechanical Keyboard',
            unitPrice: 49.99,
            quantity: 1,
            lineTotal: 49.99,
          },
        ],
      }),
      clear: jest.fn().mockResolvedValue(undefined),
    };
    ordersRepository = { findOne: jest.fn(), find: jest.fn() };
    dataSource = {
      transaction: jest.fn().mockImplementation(async (work) => {
        const manager = {
          create: (entity: unknown, data: unknown) => data,
          save: jest.fn().mockResolvedValue(savedOrder),
        };
        return work(manager);
      }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        OrderingService,
        { provide: getDataSourceToken(), useValue: dataSource },
        { provide: getRepositoryToken(Order), useValue: ordersRepository },
        { provide: BasketService, useValue: basketService },
        { provide: EventBus, useValue: eventBus },
      ],
    }).compile();

    orderingService = moduleRef.get(OrderingService);
  });

  it('persists the order inside a transaction and clears the basket', async () => {
    const result = await orderingService.placeOrder('user-1');

    expect(result).toEqual({ success: true, orderId: savedOrder.id });
    expect(basketService.assertNotEmpty).toHaveBeenCalledWith('user-1');
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(basketService.clear).toHaveBeenCalledWith('user-1');
  });

  it('publishes order.created with a snapshot of the order after it is saved', async () => {
    await orderingService.placeOrder('user-1');

    // Allow the fire-and-forget publish() microtask to run before asserting on it.
    await new Promise(process.nextTick);

    expect(eventBus.publish).toHaveBeenCalledWith(
      RoutingKeys.ORDER_CREATED,
      expect.objectContaining({
        orderId: savedOrder.id,
        userId: savedOrder.userId,
        total: 89.98,
        items: [
          { productId: 'product-1', productName: 'Wireless Mouse', quantity: 1, unitPrice: 39.99 },
          {
            productId: 'product-2',
            productName: 'Mechanical Keyboard',
            quantity: 1,
            unitPrice: 49.99,
          },
        ],
      }),
    );
  });
});
