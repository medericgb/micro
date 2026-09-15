import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { randomUUID } from 'node:crypto';
import { SERVICE_TOKENS, type DepositDto, type TransactionView } from '@app/contracts';

/**
 * Skeleton stub. Milestone 3 implements the spec's deposit flow:
 * insert PENDING, call momo.charge, settle in one DB transaction, notify.
 * The clients are injected now so the wiring is proven by the module test.
 */
@Injectable()
export class DepositService {
  constructor(
    @Inject(SERVICE_TOKENS.MOMO_SERVICE) private readonly momo: ClientProxy,
    @Inject(SERVICE_TOKENS.NOTIFICATION_SERVICE)
    private readonly notifications: ClientProxy,
  ) {}

  async deposit(dto: DepositDto): Promise<TransactionView> {
    return {
      id: randomUUID(),
      walletId: dto.walletId,
      type: 'DEPOSIT',
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
