import { Injectable, Logger } from '@nestjs/common';
import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import {
  DOMAIN_EVENTS_DLX,
  DOMAIN_EVENTS_EXCHANGE,
  OrderCreatedEvent,
  QUEUES,
  ROUTING_KEYS,
} from '../../../infrastructure/rabbitmq/constants';
import { WalletService } from '../wallet.service';

/**
 * One of four independent consumers of `order.created` (alongside Email,
 * Inventory, Analytics). This is the concrete "everything wired together"
 * moment the whole capstone is building toward: an event published by the
 * Order module (primary DB) is consumed here and resolved, via
 * ShardRouterService (inside WalletService), to a debit on the SHARD
 * database that owns this specific user - all inside the same Nest
 * process, running in parallel with the other three workers.
 */
@Injectable()
export class OrderSettlementListener {
  private readonly logger = new Logger(OrderSettlementListener.name);

  constructor(private readonly walletService: WalletService) {}

  @RabbitSubscribe({
    exchange: DOMAIN_EVENTS_EXCHANGE,
    routingKey: ROUTING_KEYS.ORDER_CREATED,
    queue: QUEUES.WALLET_SETTLEMENT_ON_ORDER_CREATED,
    queueOptions: {
      durable: true,
      arguments: { 'x-dead-letter-exchange': DOMAIN_EVENTS_DLX },
    },
  })
  async handleOrderCreated(event: OrderCreatedEvent): Promise<void> {
    this.logger.log(`[wallet-worker] Settling order ${event.orderId} for user ${event.userId}`);
    await this.walletService.debit(
      event.userId,
      event.totalCents,
      `Order settlement for order ${event.orderId}`,
      event.orderId,
    );
    this.logger.log(
      `[wallet-worker] Debited ${event.totalCents} cents from user ${event.userId}'s wallet`,
    );
  }
}
