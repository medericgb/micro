import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  WALLET_PATTERNS,
  CreateWalletDto,
  ListWalletsDto,
  GetBalanceDto,
  DepositDto,
  TransferDto,
  HistoryDto,
  type WalletView,
  type TransactionView,
  type HistoryPage,
  type HealthReport,
} from '@app/contracts';
import { WalletService } from './wallet.service';
import { DepositService } from './deposit.service';
import { TransferService } from './transfer.service';
import { LedgerService } from './ledger.service';

@Controller()
export class WalletController {
  constructor(
    private readonly wallets: WalletService,
    private readonly deposits: DepositService,
    private readonly transfers: TransferService,
    private readonly ledger: LedgerService,
  ) {}

  @MessagePattern(WALLET_PATTERNS.health)
  health(): HealthReport {
    return { service: 'wallet-service', status: 'ok' };
  }

  @MessagePattern(WALLET_PATTERNS.create)
  create(@Payload() dto: CreateWalletDto): Promise<WalletView> {
    return this.wallets.create(dto);
  }

  @MessagePattern(WALLET_PATTERNS.list)
  list(@Payload() dto: ListWalletsDto): Promise<WalletView[]> {
    return this.wallets.list(dto);
  }

  @MessagePattern(WALLET_PATTERNS.getBalance)
  getBalance(@Payload() dto: GetBalanceDto): Promise<WalletView> {
    return this.wallets.getBalance(dto);
  }

  @MessagePattern(WALLET_PATTERNS.deposit)
  deposit(@Payload() dto: DepositDto): Promise<TransactionView> {
    return this.deposits.deposit(dto);
  }

  @MessagePattern(WALLET_PATTERNS.transfer)
  transfer(@Payload() dto: TransferDto): Promise<TransactionView> {
    return this.transfers.transfer(dto);
  }

  @MessagePattern(WALLET_PATTERNS.history)
  history(@Payload() dto: HistoryDto): Promise<HistoryPage> {
    return this.ledger.history(dto);
  }
}
