import { IsOptional, IsString } from 'class-validator';

/** Every message carries a correlation id, generated at the gateway. */
export class BaseMessageDto {
  @IsOptional()
  @IsString()
  correlationId?: string;
}
