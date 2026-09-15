import { Controller, Get, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  HEALTH_PATTERNS,
  SERVICE_TOKENS,
  type ServiceName,
} from '@app/contracts';
import { call } from '../rpc';

type ServiceHealth = 'ok' | 'unreachable';

interface HealthResponse {
  status: 'ok' | 'degraded';
  services: Record<ServiceName, ServiceHealth>;
}

@Controller('health')
export class HealthController {
  constructor(
    @Inject(SERVICE_TOKENS.AUTH_SERVICE) private readonly auth: ClientProxy,
    @Inject(SERVICE_TOKENS.WALLET_SERVICE) private readonly wallet: ClientProxy,
    @Inject(SERVICE_TOKENS.NOTIFICATION_SERVICE)
    private readonly notification: ClientProxy,
    @Inject(SERVICE_TOKENS.MOMO_SERVICE) private readonly momo: ClientProxy,
  ) {}

  @Get()
  async check(): Promise<HealthResponse> {
    const clients: Record<ServiceName, ClientProxy> = {
      AUTH_SERVICE: this.auth,
      WALLET_SERVICE: this.wallet,
      NOTIFICATION_SERVICE: this.notification,
      MOMO_SERVICE: this.momo,
    };

    const names = Object.keys(clients) as ServiceName[];
    const results = await Promise.all(
      names.map(async (name): Promise<ServiceHealth> => {
        try {
          await call(clients[name], HEALTH_PATTERNS[name], {});
          return 'ok';
        } catch {
          return 'unreachable';
        }
      }),
    );

    const services = Object.fromEntries(
      names.map((name, index) => [name, results[index]]),
    ) as Record<ServiceName, ServiceHealth>;

    return {
      status: results.every((r) => r === 'ok') ? 'ok' : 'degraded',
      services,
    };
  }
}
