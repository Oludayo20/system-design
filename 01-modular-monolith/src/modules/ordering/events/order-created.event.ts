/**
 * Payload published on `order.created`. Deliberately a flat, self-contained snapshot — consumers
 * (Inventory, Notifications) must not need to call back into Ordering or Catalog to act on it.
 */
export interface OrderCreatedEvent {
  orderId: string;
  userId: string;
  total: number;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
  }>;
}

export interface OrderCancelledEvent {
  orderId: string;
  userId: string;
}
