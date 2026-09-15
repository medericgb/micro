import { Body, Controller, Inject, Post, UseGuards } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { randomUUID } from 'node:crypto';
import {
  WALLET_PATTERNS,
  SERVICE_TOKENS,
  type TransactionView,
  type TokenClaims,
} from '@app/contracts';
import { JwtGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { call } from '../rpc';

@UseGuards(JwtGuard)
@Controller('transfers')
export class TransfersController {
  constructor(
    @Inject(SERVICE_TOKENS.WALLET_SERVICE) private readonly wallet: ClientProxy,
  ) {}

  @Post()
  transfer(
    @CurrentUser() user: TokenClaims,
    @Body() body: { toEmail: string; amount: string; idempotencyKey?: string },
  ): Promise<TransactionView> {
    return call<TransactionView>(this.wallet, WALLET_PATTERNS.transfer, {
      fromUserId: user.userId,
      toEmail: body.toEmail,
      amount: body.amount,
      idempotencyKey: body.idempotencyKey ?? randomUUID(),
    });
  }
}
