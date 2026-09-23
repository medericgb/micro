import { AMOUNT_PATTERN, MAX_AMOUNT } from '@app/common';
import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { BaseMessageDto } from '../base.dto';

export class ChargeDto extends BaseMessageDto {
  @IsString() @IsNotEmpty() msisdn!: string;
  @Matches(AMOUNT_PATTERN, {
    message: `amount must be a decimal string with at most 2 places, up to ${MAX_AMOUNT}`,
  })
  amount!: string;
  @IsString() @IsNotEmpty() reference!: string;
}

export class PayoutDto extends BaseMessageDto {
  @IsString() @IsNotEmpty() msisdn!: string;
  @Matches(AMOUNT_PATTERN, {
    message: `amount must be a decimal string with at most 2 places, up to ${MAX_AMOUNT}`,
  })
  amount!: string;
  @IsString() @IsNotEmpty() reference!: string;
}

export class ProviderStatusDto extends BaseMessageDto {
  @IsString() @IsNotEmpty() providerRef!: string;
}

export type ProviderOutcome = 'SUCCESS' | 'PENDING' | 'DECLINED';

export interface ProviderResult {
  providerRef: string;
  outcome: ProviderOutcome;
  reason: string | null;
}
