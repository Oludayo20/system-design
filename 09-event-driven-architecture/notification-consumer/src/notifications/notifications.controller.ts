import { Controller, Get } from '@nestjs/common';
import { Notification } from './notification.model';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /** Inspection endpoint: every push notification sent, newest first. */
  @Get()
  getAll(): Notification[] {
    return this.notificationsService.getAll();
  }
}
