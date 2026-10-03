import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ClientsModule } from '@nestjs/microservices';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { clientOptions, getEnv } from '@app/common';
import { globalThrottle } from './security.config';
import { AuthController } from './auth/auth.controller';
import { WalletsController } from './wallets/wallets.controller';
import { TransfersController } from './transfers/transfers.controller';
import { NotificationsController } from './notifications/notifications.controller';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.register({
      secret: getEnv('JWT_SECRET', 'dev-only-change-me'),
    }),
    ThrottlerModule.forRoot(globalThrottle()),
    ClientsModule.register([
      clientOptions('AUTH_SERVICE'),
      clientOptions('WALLET_SERVICE'),
      clientOptions('NOTIFICATION_SERVICE'),
      clientOptions('MOMO_SERVICE'),
    ]),
  ],
  controllers: [
    AuthController,
    WalletsController,
    TransfersController,
    NotificationsController,
    HealthController,
  ],
  // Global, so a route added later is rate limited by default rather than by
  // remembering to decorate it.
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class ApiGatewayModule {}
