import { Test } from '@nestjs/testing';
import { MomoController } from './momo.controller';
import { MomoService } from './momo.service';
import { PrismaService } from './prisma.service';

describe('MomoController', () => {
  let controller: MomoController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [MomoController],
      providers: [MomoService, { provide: PrismaService, useValue: {} }],
    }).compile();

    controller = moduleRef.get(MomoController);
  });

  it('reports health without touching the database', () => {
    expect(controller.health()).toEqual({ service: 'momo-sim', status: 'ok' });
  });

  it('returns a typed stub for charge', async () => {
    const result = await controller.charge({
      msisdn: '237600000001',
      amount: '10.00',
      reference: 'ref-1',
    });
    expect(result).toMatchObject({ outcome: 'SUCCESS', reason: null });
    expect(typeof result.providerRef).toBe('string');
  });

  it('returns a typed stub for payout', async () => {
    const result = await controller.payout({
      msisdn: '237600000001',
      amount: '10.00',
      reference: 'ref-2',
    });
    expect(result.outcome).toBe('SUCCESS');
  });

  it('returns a typed stub for status', async () => {
    const result = await controller.status({ providerRef: 'pr-1' });
    expect(result.providerRef).toBe('pr-1');
    expect(result.outcome).toBe('SUCCESS');
  });
});
