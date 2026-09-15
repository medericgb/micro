import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  SendNotificationDto,
  ListNotificationsDto,
  MarkReadDto,
  NotificationView,
  NotificationPage,
} from '@app/contracts';

/** Skeleton stub. Milestone 6 replaces these bodies with PrismaService calls. */
@Injectable()
export class NotificationService {
  async send(dto: SendNotificationDto): Promise<NotificationView> {
    return {
      id: randomUUID(),
      userId: dto.userId,
      type: dto.type,
      title: dto.title,
      body: dto.body,
      readAt: null,
      createdAt: new Date().toISOString(),
    };
  }

  async list(dto: ListNotificationsDto): Promise<NotificationPage> {
    return { items: [], nextCursor: null };
  }

  async markRead(dto: MarkReadDto): Promise<NotificationView> {
    const now = new Date().toISOString();
    return {
      id: dto.notificationId,
      userId: dto.userId,
      type: 'STUB',
      title: 'Stub notification',
      body: 'Replaced in milestone 6.',
      readAt: now,
      createdAt: now,
    };
  }
}
