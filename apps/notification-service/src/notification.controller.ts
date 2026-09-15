import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  NOTIFICATION_PATTERNS,
  SendNotificationDto,
  ListNotificationsDto,
  MarkReadDto,
  type NotificationView,
  type NotificationPage,
  type HealthReport,
} from '@app/contracts';
import { NotificationService } from './notification.service';

@Controller()
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  @MessagePattern(NOTIFICATION_PATTERNS.health)
  health(): HealthReport {
    return { service: 'notification-service', status: 'ok' };
  }

  @MessagePattern(NOTIFICATION_PATTERNS.send)
  send(@Payload() dto: SendNotificationDto): Promise<NotificationView> {
    return this.notifications.send(dto);
  }

  @MessagePattern(NOTIFICATION_PATTERNS.list)
  list(@Payload() dto: ListNotificationsDto): Promise<NotificationPage> {
    return this.notifications.list(dto);
  }

  @MessagePattern(NOTIFICATION_PATTERNS.markRead)
  markRead(@Payload() dto: MarkReadDto): Promise<NotificationView> {
    return this.notifications.markRead(dto);
  }
}
