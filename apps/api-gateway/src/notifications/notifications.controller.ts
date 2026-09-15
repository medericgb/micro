import {
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  NOTIFICATION_PATTERNS,
  SERVICE_TOKENS,
  type NotificationView,
  type NotificationPage,
  type TokenClaims,
} from '@app/contracts';
import { JwtGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { call } from '../rpc';

@UseGuards(JwtGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    @Inject(SERVICE_TOKENS.NOTIFICATION_SERVICE)
    private readonly notifications: ClientProxy,
  ) {}

  @Get()
  list(
    @CurrentUser() user: TokenClaims,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ): Promise<NotificationPage> {
    return call<NotificationPage>(
      this.notifications,
      NOTIFICATION_PATTERNS.list,
      {
        userId: user.userId,
        cursor,
        limit: limit ? Number(limit) : undefined,
      },
    );
  }

  @Post(':notificationId/read')
  markRead(
    @CurrentUser() user: TokenClaims,
    @Param('notificationId', ParseUUIDPipe) notificationId: string,
  ): Promise<NotificationView> {
    return call<NotificationView>(
      this.notifications,
      NOTIFICATION_PATTERNS.markRead,
      { userId: user.userId, notificationId },
    );
  }
}
