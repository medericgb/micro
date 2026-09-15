import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { toDecimal } from '@app/common';
import {
  DEFAULT_CURRENCY,
  type CreateWalletDto,
  type ListWalletsDto,
  type GetBalanceDto,
  type WalletView,
} from '@app/contracts';

/** Skeleton stub. Milestone 2 replaces these bodies with PrismaService calls. */
@Injectable()
export class WalletService {
  private stubWallet(id: string, userId: string, currency: string): WalletView {
    return {
      id,
      userId,
      currency,
      balance: toDecimal(0n),
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    };
  }

  async create(dto: CreateWalletDto): Promise<WalletView> {
    return this.stubWallet(randomUUID(), dto.userId, dto.currency ?? DEFAULT_CURRENCY);
  }

  async list(dto: ListWalletsDto): Promise<WalletView[]> {
    return [];
  }

  async getBalance(dto: GetBalanceDto): Promise<WalletView> {
    return this.stubWallet(dto.walletId, dto.userId, DEFAULT_CURRENCY);
  }
}
