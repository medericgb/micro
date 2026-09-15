import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { randomUUID } from 'node:crypto';
import { SERVICE_TOKENS, type TransferDto, type TransactionView } from '@app/contracts';

/**
 * Skeleton stub. Milestone 4 implements the spec's transfer flow: resolve the
 * recipient via auth.find_by_email, then debit and credit both wallets inside
 * a single Prisma $transaction, then notify both users.
 */
@Injectable()
export class TransferService {
  constructor(
    @Inject(SERVICE_TOKENS.AUTH_SERVICE) private readonly auth: ClientProxy,
    @Inject(SERVICE_TOKENS.NOTIFICATION_SERVICE)
    private readonly notifications: ClientProxy,
  ) {}

  async transfer(dto: TransferDto): Promise<TransactionView> {
    return {
      id: randomUUID(),
      walletId: randomUUID(),
      type: 'TRANSFER_OUT',
      status: 'PENDING',
      amount: dto.amount,
      balanceAfter: null,
      counterpartyWalletId: null,
      providerRef: null,
      failureReason: null,
      createdAt: new Date().toISOString(),
    };
  }
}
