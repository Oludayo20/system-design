import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Fire-and-forget call to notification-service, made over a real HTTP
 * request (so the network dependency is genuinely there, not simulated) -
 * but bounded by a short timeout and wrapped so ANY failure (timeout,
 * connection refused, 5xx, DNS failure) is logged and swallowed rather
 * than propagated.
 *
 * This is the fault-isolation lesson made real: order-service's job is to
 * place orders, not to guarantee a notification was sent. Stop
 * notification-service entirely (`docker compose stop notification-service`)
 * and `placeOrder` below still returns 201 - see README "Fault isolation".
 *
 * A production system would replace this synchronous best-effort call with
 * a durable queue (as in 03-async-queue-processing) so a failed
 * notification could be retried instead of silently dropped - noted here,
 * not built, to keep this project focused on ONE lesson at a time.
 */
@Injectable()
export class NotificationClientService {
  private readonly logger = new Logger(NotificationClientService.name);
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = this.config.get<string>('notificationServiceUrl')!;
    this.timeoutMs = this.config.get<number>('notificationTimeoutMs')!;
  }

  async notifyOrderCreated(orderId: string, userId: string, bookId: string, quantity: number): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'order.created',
          userId,
          message: `Order ${orderId} placed for ${quantity}x book ${bookId}`,
          metadata: { orderId, bookId, quantity },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        this.logger.warn(
          `notification-service returned ${response.status} for order ${orderId} - continuing anyway`,
        );
      } else {
        this.logger.log(`notification-service acknowledged order ${orderId}`);
      }
    } catch (error) {
      // Swallowed on purpose: a notification failure must never fail an order.
      this.logger.warn(
        `notification-service call failed for order ${orderId} (${(error as Error).message}) - ` +
          'order still succeeds, this is fault isolation working as intended',
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
