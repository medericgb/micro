import { INestApplication, INestMicroservice } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions } from '@nestjs/microservices';
import request from 'supertest';
import { microserviceOptions, type ServiceName } from '@app/common';
import { ApiGatewayModule } from '../src/api-gateway.module';
import { AuthServiceModule } from '../../auth-service/src/auth-service.module';
import { WalletServiceModule } from '../../wallet-service/src/wallet-service.module';
import { NotificationServiceModule } from '../../notification-service/src/notification-service.module';
import { MomoSimModule } from '../../momo-sim/src/momo-sim.module';

describe('GET /health (e2e)', () => {
  let gateway: INestApplication;
  const services: INestMicroservice[] = [];

  async function startService(
    module: unknown,
    name: ServiceName,
  ): Promise<void> {
    const service = await NestFactory.createMicroservice<MicroserviceOptions>(
      module as never,
      microserviceOptions(name),
    );
    await service.listen();
    services.push(service);
  }

  beforeAll(async () => {
    await startService(AuthServiceModule, 'AUTH_SERVICE');
    await startService(WalletServiceModule, 'WALLET_SERVICE');
    await startService(NotificationServiceModule, 'NOTIFICATION_SERVICE');
    await startService(MomoSimModule, 'MOMO_SERVICE');

    gateway = await NestFactory.create(ApiGatewayModule, { logger: false });
    await gateway.init();
  });

  afterAll(async () => {
    await gateway?.close();
    await Promise.all(services.map((s) => s.close()));
  });

  it('reports every service healthy over real TCP', async () => {
    const response = await request(gateway.getHttpServer())
      .get('/health')
      .expect(200);

    expect(response.body).toEqual({
      status: 'ok',
      services: {
        AUTH_SERVICE: 'ok',
        WALLET_SERVICE: 'ok',
        NOTIFICATION_SERVICE: 'ok',
        MOMO_SERVICE: 'ok',
      },
    });
  });
});
