import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClientsModule } from '@nestjs/microservices';
import { clientOptions } from '@app/common';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { DepositService } from './deposit.service';
import { TransferService } from './transfer.service';
import { LedgerService } from './ledger.service';
import { PrismaService } from './prisma.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ClientsModule.register([
      clientOptions('MOMO_SERVICE'),
      clientOptions('NOTIFICATION_SERVICE'),
      clientOptions('AUTH_SERVICE'),
    ]),
  ],
  controllers: [WalletController],
  providers: [
    WalletService,
    DepositService,
    TransferService,
    LedgerService,
    PrismaService,
  ],
})
export class WalletServiceModule {}
