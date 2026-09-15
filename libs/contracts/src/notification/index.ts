import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { BaseMessageDto } from '../base.dto';

export class SendNotificationDto extends BaseMessageDto {
  @IsUUID() userId!: string;
  @IsString() @IsNotEmpty() type!: string;
  @IsString() @IsNotEmpty() title!: string;
  @IsString() @IsNotEmpty() body!: string;
}

export class ListNotificationsDto extends BaseMessageDto {
  @IsUUID() userId!: string;
  @IsOptional() @IsString() cursor?: string;
  @IsOptional() @IsInt() @Min(1) @Max(100) limit?: number;
}

export class MarkReadDto extends BaseMessageDto {
  @IsUUID() userId!: string;
  @IsUUID() notificationId!: string;
}

export interface NotificationView {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationPage {
  items: NotificationView[];
  nextCursor: string | null;
}
