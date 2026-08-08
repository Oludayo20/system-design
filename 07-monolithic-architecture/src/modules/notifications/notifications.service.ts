import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification) private readonly notifications: Repository<Notification>,
  ) {}

  /**
   * Simulated notification: just a row in the `notifications` table (no real email/push
   * provider). Called synchronously, in-process, by CommentsService right after it saves a
   * comment — same request, same transaction-less call stack, same failure domain. If this
   * insert throws, it throws inside the comment-creation request, because that's what "no event
   * bus, no queue" means in a plain monolith.
   */
  async notifyNewComment(recipientId: string, message: string): Promise<Notification> {
    const notification = await this.notifications.save(
      this.notifications.create({ recipientId, message }),
    );
    this.logger.log(`Notified ${recipientId}: ${message}`);
    return notification;
  }

  async findForUser(userId: string): Promise<Notification[]> {
    return this.notifications.find({
      where: { recipientId: userId },
      order: { createdAt: 'DESC' },
    });
  }
}
