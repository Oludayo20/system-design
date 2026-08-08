import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { ApiReadErrors } from '../../shared/swagger/api-error.decorators';
import { AuthenticatedUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationResponseDto } from './dto/notification-response.dto';
import { Notification } from './entities/notification.entity';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('me')
  @ApiOperation({
    summary: "List the current user's notifications",
    description:
      'Not one of the endpoints the doc.md diagram calls out, but useful here to prove ' +
      'CommentsService -> NotificationsService.notifyNewComment() actually wrote a row.',
  })
  @ApiResponse({ status: 200, description: 'Notifications for the current user.', type: [NotificationResponseDto] })
  @ApiReadErrors({ auth: true })
  findMine(@CurrentUser() user: AuthenticatedUser): Promise<Notification[]> {
    return this.notificationsService.findForUser(user.userId);
  }
}
