import { Body, Controller, Inject, Post } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  AUTH_PATTERNS,
  WALLET_PATTERNS,
  SERVICE_TOKENS,
  RegisterDto,
  LoginDto,
  DEFAULT_CURRENCY,
  type UserView,
  type AuthTokens,
} from '@app/contracts';
import { call } from '../rpc';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(SERVICE_TOKENS.AUTH_SERVICE) private readonly auth: ClientProxy,
    @Inject(SERVICE_TOKENS.WALLET_SERVICE) private readonly wallet: ClientProxy,
  ) {}

  /**
   * The gateway orchestrates both calls: auth-service must never call
   * wallet-service, because wallet-service already calls auth-service and the
   * reverse edge would create a cycle. wallet.create is idempotent on
   * (userId, currency), so a failure here self-heals on first wallet access.
   */
  @Post('register')
  async register(@Body() dto: RegisterDto): Promise<UserView> {
    const user = await call<UserView>(this.auth, AUTH_PATTERNS.register, dto);
    await call(this.wallet, WALLET_PATTERNS.create, {
      userId: user.id,
      currency: DEFAULT_CURRENCY,
    });
    return user;
  }

  @Post('login')
  login(@Body() dto: LoginDto): Promise<AuthTokens> {
    return call<AuthTokens>(this.auth, AUTH_PATTERNS.login, dto);
  }
}
