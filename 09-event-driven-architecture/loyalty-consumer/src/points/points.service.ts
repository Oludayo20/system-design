import { Injectable, Logger } from '@nestjs/common';
import { OrderPlacedEvent } from '../order-placed.event';
import { PointsSummary } from './points.model';

/**
 * Idempotency, for real.
 *
 * RabbitMQ (like every broker offering at-least-once delivery) can redeliver a message that was
 * already successfully processed — e.g. the consumer crashes after doing the work but before it
 * manages to ack, or a network blip causes the broker to assume the worst and redeliver. "Only
 * award points once per order" therefore can't rely on "only receive the message once", because
 * that guarantee doesn't exist. Instead we track which `eventId`s have already been applied (a
 * `Set`, in-memory for this demo; a real system would use a unique constraint on `event_id` in
 * whatever table records the side effect) and skip anything already seen.
 *
 * See scripts/simulate-duplicate-delivery.ts for a script that sends the exact same eventId to
 * this consumer's queue twice, and the README for how to run it and read the result.
 */
@Injectable()
export class PointsService {
  private readonly logger = new Logger(PointsService.name);
  private readonly pointsByCustomer = new Map<string, number>();
  private readonly processedEventIds = new Set<string>();

  async awardForOrder(event: OrderPlacedEvent): Promise<void> {
    if (this.processedEventIds.has(event.eventId)) {
      this.logger.warn(
        `Duplicate delivery of eventId=${event.eventId} (orderId=${event.payload.orderId}) — ` +
          'already processed. Skipping so points are not awarded twice.',
      );
      return;
    }

    const points = Math.max(1, Math.round(event.payload.totalAmount));
    const current = this.pointsByCustomer.get(event.payload.customerId) ?? 0;
    const next = current + points;
    this.pointsByCustomer.set(event.payload.customerId, next);
    this.processedEventIds.add(event.eventId);

    this.logger.log(
      `order.placed (orderId=${event.payload.orderId}, eventId=${event.eventId}): awarded ` +
        `${points} points to ${event.payload.customerId} (total now ${next})`,
    );
  }

  getSummary(): PointsSummary {
    return {
      customers: Array.from(this.pointsByCustomer.entries()).map(([customerId, points]) => ({
        customerId,
        points,
      })),
      processedEventCount: this.processedEventIds.size,
    };
  }
}
