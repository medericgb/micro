import { AMOUNT_PATTERN, MAX_AMOUNT } from '@app/common';
import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { BaseMessageDto } from '../base.dto';

export const DEFAULT_CURRENCY = 'XAF';

export class CreateWalletDto extends BaseMessageDto {
  @IsUUID() userId!: string;
  @IsOptional() @IsString() @Length(3, 3) currency?: string;
}

export class ListWalletsDto extends BaseMessageDto {
  @IsUUID() userId!: string;
}

export class GetBalanceDto extends BaseMessageDto {
  @IsUUID() userId!: string;
  @IsUUID() walletId!: string;
}

export class DepositDto extends BaseMessageDto {
  @IsUUID() walletId!: string;
  @IsUUID() userId!: string;
  @Matches(AMOUNT_PATTERN, {
    message: `amount must be a decimal string with at most 2 places, up to ${MAX_AMOUNT}`,
  })
  amount!: string;
  @IsString() @IsNotEmpty() msisdn!: string;
  @IsString() @IsNotEmpty() idempotencyKey!: string;
}

export class TransferDto extends BaseMessageDto {
  @IsUUID() fromUserId!: string;
  @IsEmail() toEmail!: string;
  @Matches(AMOUNT_PATTERN, {
    message: `amount must be a decimal string with at most 2 places, up to ${MAX_AMOUNT}`,
  })
  amount!: string;
  @IsString() @IsNotEmpty() idempotencyKey!: string;
}

export class HistoryDto extends BaseMessageDto {
  @IsUUID() userId!: string;
  @IsUUID() walletId!: string;
  @IsOptional() @IsString() cursor?: string;
  @IsOptional() @IsInt() @Min(1) @Max(100) limit?: number;
}

export type TxType = 'DEPOSIT' | 'TRANSFER_IN' | 'TRANSFER_OUT';
export type TxStatus = 'PENDING' | 'COMPLETED' | 'FAILED';
export type WalletStatus = 'ACTIVE' | 'FROZEN' | 'CLOSED';

/** balance is a decimal string: BigInt cannot be JSON-serialized. */
export interface WalletView {
  id: string;
  userId: string;
  currency: string;
  balance: string;
  status: WalletStatus;
  createdAt: string;
}

export interface TransactionView {
  id: string;
  walletId: string;
  type: TxType;
  status: TxStatus;
  amount: string;
  balanceAfter: string | null;
  counterpartyWalletId: string | null;
  providerRef: string | null;
  failureReason: string | null;
  createdAt: string;
}

export interface HistoryPage {
  items: TransactionView[];
  nextCursor: string | null;
}
