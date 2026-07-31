/**
 * Same shape as project 01 (modular monolith) and project 03 (async queue
 * processing): a topic exchange named `domain_events`, one routing key per
 * domain event, one durable queue per independent worker. Multiple queues
 * bound to the same routing key is exactly what makes 4 workers (Email,
 * Inventory, Analytics, Wallet settlement) all react to a single
 * `order.created` publish, independently and in parallel.
 */
export const DOMAIN_EVENTS_EXCHANGE = 'domain_events';
export const DOMAIN_EVENTS_DLX = 'domain_events.dlx';

export const ROUTING_KEYS = {
  ORDER_CREATED: 'order.created',
} as const;

export const QUEUES = {
  EMAIL_ON_ORDER_CREATED: 'email.order_created',
  INVENTORY_ON_ORDER_CREATED: 'inventory.order_created',
  ANALYTICS_ON_ORDER_CREATED: 'analytics.order_created',
  WALLET_SETTLEMENT_ON_ORDER_CREATED: 'wallet_settlement.order_created',
} as const;

export interface OrderCreatedEvent {
  orderId: string;
  userId: string;
  totalCents: number;
  items: Array<{ productId: string; quantity: number; unitPriceCents: number }>;
  createdAt: string;
}
