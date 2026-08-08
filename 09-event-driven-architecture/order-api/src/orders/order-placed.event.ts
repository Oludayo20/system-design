import { OrderItem } from './entities/order.entity';

/**
 * Every event on `grocery_events` carries this envelope. `eventId` is what makes idempotency
 * possible downstream (see loyalty-consumer) — it must be stable across redeliveries of "the
 * same" event, so it is generated once, at the moment the event is created, never regenerated
 * on retry/replay.
 */
export interface OrderPlacedEvent {
  eventId: string;
  eventType: 'order.placed';
  occurredAt: string;
  payload: {
    orderId: string;
    customerId: string;
    items: OrderItem[];
    totalAmount: number;
  };
}
