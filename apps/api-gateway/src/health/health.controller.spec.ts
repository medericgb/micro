import { Test } from '@nestjs/testing';
import { of, throwError } from 'rxjs';
import { SERVICE_TOKENS } from '@app/contracts';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  function clientReturning(service: string) {
    return { send: jest.fn().mockReturnValue(of({ service, status: 'ok' })) };
  }

  async function build(overrides: Record<string, unknown> = {}) {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: SERVICE_TOKENS.AUTH_SERVICE, useValue: overrides.AUTH_SERVICE ?? clientReturning('auth-service') },
        { provide: SERVICE_TOKENS.WALLET_SERVICE, useValue: overrides.WALLET_SERVICE ?? clientReturning('wallet-service') },
        { provide: SERVICE_TOKENS.NOTIFICATION_SERVICE, useValue: overrides.NOTIFICATION_SERVICE ?? clientReturning('notification-service') },
        { provide: SERVICE_TOKENS.MOMO_SERVICE, useValue: overrides.MOMO_SERVICE ?? clientReturning('momo-sim') },
      ],
    }).compile();
    return moduleRef.get(HealthController);
  }

  it('reports ok when every service answers', async () => {
    const result = await (await build()).check();
    expect(result.status).toBe('ok');
    expect(result.services).toEqual({
      AUTH_SERVICE: 'ok',
      WALLET_SERVICE: 'ok',
      NOTIFICATION_SERVICE: 'ok',
      MOMO_SERVICE: 'ok',
    });
  });

  it('degrades and names the failing service rather than throwing', async () => {
    const controller = await build({
      MOMO_SERVICE: { send: () => throwError(() => new Error('ECONNREFUSED')) },
    });
    const result = await controller.check();
    expect(result.status).toBe('degraded');
    expect(result.services.MOMO_SERVICE).toBe('unreachable');
    expect(result.services.AUTH_SERVICE).toBe('ok');
  });
});
