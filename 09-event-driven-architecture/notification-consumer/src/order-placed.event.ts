/**
 * notification-consumer's own copy of the event contract order-api publishes. No shared npm
 * package between order-api and its consumers — the event's JSON shape (documented in the root
 * README) is the only contract between them.
 */
export interface OrderPlacedEvent {
  eventId: string;
  eventType: 'order.placed';
  occurredAt: string;
  payload: {
    orderId: string;
    customerId: string;
    items: { sku: string; name: string; quantity: number; unitPrice: number }[];
    totalAmount: number;
  };
}
