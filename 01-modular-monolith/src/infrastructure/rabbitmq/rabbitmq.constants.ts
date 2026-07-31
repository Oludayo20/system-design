export const DOMAIN_EVENTS_EXCHANGE = 'domain_events';

/**
 * Routing keys published on the `domain_events` topic exchange.
 * Keep this list in sync with every `@RabbitSubscribe` binding in the codebase.
 */
export const RoutingKeys = {
  ORDER_CREATED: 'order.created',
  ORDER_CANCELLED: 'order.cancelled',
} as const;

export type RoutingKey = (typeof RoutingKeys)[keyof typeof RoutingKeys];

/**
 * Standard envelope wrapped around every payload published to the event bus, so every
 * consumer can log/trace/replay events uniformly regardless of which module emitted them.
 */
export interface EventEnvelope<T = unknown> {
  event: string;
  timestamp: string;
  payload: T;
}
