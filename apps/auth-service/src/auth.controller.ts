import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  AUTH_PATTERNS,
  RegisterDto,
  LoginDto,
  FindByEmailDto,
  GetUserDto,
  ValidateTokenDto,
  type UserView,
  type AuthTokens,
  type TokenClaims,
  type HealthReport,
} from '@app/contracts';
import { AuthService } from './auth.service';

@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @MessagePattern(AUTH_PATTERNS.health)
  health(): HealthReport {
    return { service: 'auth-service', status: 'ok' };
  }

  @MessagePattern(AUTH_PATTERNS.register)
  register(@Payload() dto: RegisterDto): Promise<UserView> {
    return this.auth.register(dto);
  }

  @MessagePattern(AUTH_PATTERNS.login)
  login(@Payload() dto: LoginDto): Promise<AuthTokens> {
    return this.auth.login(dto);
  }

  @MessagePattern(AUTH_PATTERNS.validateToken)
  validateToken(@Payload() dto: ValidateTokenDto): Promise<TokenClaims> {
    return this.auth.validateToken(dto);
  }

  @MessagePattern(AUTH_PATTERNS.getUser)
  getUser(@Payload() dto: GetUserDto): Promise<UserView> {
    return this.auth.getUser(dto);
  }

  @MessagePattern(AUTH_PATTERNS.findByEmail)
  findByEmail(@Payload() dto: FindByEmailDto): Promise<UserView> {
    return this.auth.findByEmail(dto);
  }
}
