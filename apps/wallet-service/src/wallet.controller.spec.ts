import { Test } from '@nestjs/testing';
import { ClientProxy } from '@nestjs/microservices';
import { SERVICE_TOKENS } from '@app/contracts';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { DepositService } from './deposit.service';
import { TransferService } from './transfer.service';
import { LedgerService } from './ledger.service';
import { PrismaService } from './prisma.service';

const USER_ID = '22222222-2222-4222-8222-222222222222';
const WALLET_ID = '11111111-1111-4111-8111-111111111111';

describe('WalletController', () => {
  let controller: WalletController;

  beforeEach(async () => {
    const clientMock: Partial<ClientProxy> = { send: jest.fn(), emit: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      controllers: [WalletController],
      providers: [
        WalletService,
        DepositService,
        TransferService,
        LedgerService,
        { provide: PrismaService, useValue: {} },
        { provide: SERVICE_TOKENS.MOMO_SERVICE, useValue: clientMock },
        { provide: SERVICE_TOKENS.NOTIFICATION_SERVICE, useValue: clientMock },
        { provide: SERVICE_TOKENS.AUTH_SERVICE, useValue: clientMock },
      ],
    }).compile();

    controller = moduleRef.get(WalletController);
  });

  it('reports health', () => {
    expect(controller.health()).toEqual({ service: 'wallet-service', status: 'ok' });
  });

  it('defaults a created wallet to XAF with a zero balance', async () => {
    const result = await controller.create({ userId: USER_ID });
    expect(result).toMatchObject({
      userId: USER_ID,
      currency: 'XAF',
      balance: '0.00',
      status: 'ACTIVE',
    });
  });

  it('honours an explicit currency', async () => {
    expect((await controller.create({ userId: USER_ID, currency: 'EUR' })).currency).toBe('EUR');
  });

  it('returns balances as decimal strings, never BigInt', async () => {
    const result = await controller.getBalance({ userId: USER_ID, walletId: WALLET_ID });
    expect(typeof result.balance).toBe('string');
    expect(() => JSON.stringify(result)).not.toThrow();
  });

  it('returns a pending deposit stub', async () => {
    const result = await controller.deposit({
      walletId: WALLET_ID,
      userId: USER_ID,
      amount: '25.00',
      msisdn: '237600000001',
      idempotencyKey: 'dep-1',
    });
    expect(result).toMatchObject({ type: 'DEPOSIT', status: 'PENDING', amount: '25.00' });
  });

  it('returns a transfer stub', async () => {
    const result = await controller.transfer({
      fromUserId: USER_ID,
      toEmail: 'grace@example.com',
      amount: '25.00',
      idempotencyKey: 'tr-1',
    });
    expect(result.type).toBe('TRANSFER_OUT');
  });

  it('returns an empty history page', async () => {
    expect(await controller.history({ userId: USER_ID, walletId: WALLET_ID })).toEqual({
      items: [],
      nextCursor: null,
    });
  });
});
