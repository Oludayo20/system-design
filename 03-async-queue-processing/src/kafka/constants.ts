export const ORDER_EVENTS_TOPIC = 'order-events';

export const CONSUMER_GROUPS = ['inventory-group', 'analytics-group', 'fraud-group'] as const;
export type ConsumerGroup = (typeof CONSUMER_GROUPS)[number];
