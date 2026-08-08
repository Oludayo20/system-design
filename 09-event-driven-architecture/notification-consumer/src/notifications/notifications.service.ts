import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { OrderPlacedEvent } from '../order-placed.event';
import { Notification } from './notification.model';

/**
 * In-memory store — fine for a teaching demo. A real notification service would persist sends
 * and integrate a push provider (FCM/APNs); the point here is that this consumer reacts to
 * order.placed on its own, with its own storage, on its own schedule.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly notifications: Notification[] = [];

  async sendForOrder(event: OrderPlacedEvent): Promise<void> {
    const notification: Notification = {
      id: randomUUID(),
      orderId: event.payload.orderId,
      customerId: event.payload.customerId,
      message: `Your FreshCart order (${event.payload.items.length} item(s), $${event.payload.totalAmount.toFixed(2)}) has been placed!`,
      sentAt: new Date().toISOString(),
    };
    this.notifications.unshift(notification);
    this.logger.log(
      `order.placed (orderId=${event.payload.orderId}, eventId=${event.eventId}): push sent to ` +
        `customer ${event.payload.customerId}`,
    );
  }

  getAll(): Notification[] {
    return this.notifications;
  }
}
