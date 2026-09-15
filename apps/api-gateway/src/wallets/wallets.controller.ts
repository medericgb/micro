import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { randomUUID } from 'node:crypto';
import {
  WALLET_PATTERNS,
  SERVICE_TOKENS,
  type WalletView,
  type TransactionView,
  type HistoryPage,
  type TokenClaims,
} from '@app/contracts';
import { JwtGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { call } from '../rpc';

@UseGuards(JwtGuard)
@Controller('wallets')
export class WalletsController {
  constructor(
    @Inject(SERVICE_TOKENS.WALLET_SERVICE) private readonly wallet: ClientProxy,
  ) {}

  @Get()
  list(@CurrentUser() user: TokenClaims): Promise<WalletView[]> {
    return call<WalletView[]>(this.wallet, WALLET_PATTERNS.list, {
      userId: user.userId,
    });
  }

  @Post()
  create(
    @CurrentUser() user: TokenClaims,
    @Body('currency') currency?: string,
  ): Promise<WalletView> {
    return call<WalletView>(this.wallet, WALLET_PATTERNS.create, {
      userId: user.userId,
      currency,
    });
  }

  @Get(':walletId/balance')
  balance(
    @CurrentUser() user: TokenClaims,
    @Param('walletId', ParseUUIDPipe) walletId: string,
  ): Promise<WalletView> {
    return call<WalletView>(this.wallet, WALLET_PATTERNS.getBalance, {
      userId: user.userId,
      walletId,
    });
  }

  @Post(':walletId/deposits')
  deposit(
    @CurrentUser() user: TokenClaims,
    @Param('walletId', ParseUUIDPipe) walletId: string,
    @Body() body: { amount: string; msisdn: string; idempotencyKey?: string },
  ): Promise<TransactionView> {
    return call<TransactionView>(this.wallet, WALLET_PATTERNS.deposit, {
      userId: user.userId,
      walletId,
      amount: body.amount,
      msisdn: body.msisdn,
      idempotencyKey: body.idempotencyKey ?? randomUUID(),
    });
  }

  @Get(':walletId/transactions')
  history(
    @CurrentUser() user: TokenClaims,
    @Param('walletId', ParseUUIDPipe) walletId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ): Promise<HistoryPage> {
    return call<HistoryPage>(this.wallet, WALLET_PATTERNS.history, {
      userId: user.userId,
      walletId,
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }
}
