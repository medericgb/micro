import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ClientsModule } from '@nestjs/microservices';
import { clientOptions } from '@app/common';
import { AuthController } from './auth/auth.controller';
import { WalletsController } from './wallets/wallets.controller';
import { TransfersController } from './transfers/transfers.controller';
import { NotificationsController } from './notifications/notifications.controller';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-only-change-me',
    }),
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
})
export class ApiGatewayModule {}
