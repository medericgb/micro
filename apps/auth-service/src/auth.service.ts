import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import type {
  RegisterDto,
  LoginDto,
  FindByEmailDto,
  GetUserDto,
  ValidateTokenDto,
  UserView,
  AuthTokens,
  TokenClaims,
} from '@app/contracts';

/**
 * Skeleton stub. Milestone 1 replaces these bodies with bcrypt hashing and
 * PrismaService lookups. The shapes returned here are already final.
 */
@Injectable()
export class AuthService {
  constructor(private readonly jwt: JwtService) {}

  private stubUser(id: string, email: string): UserView {
    return {
      id,
      email,
      fullName: 'Stub User',
      createdAt: new Date().toISOString(),
    };
  }

  async register(dto: RegisterDto): Promise<UserView> {
    return {
      id: randomUUID(),
      email: dto.email,
      fullName: dto.fullName,
      createdAt: new Date().toISOString(),
    };
  }

  async login(dto: LoginDto): Promise<AuthTokens> {
    const expiresIn = Number(process.env.JWT_EXPIRES_IN ?? 3600);
    const claims: TokenClaims = { userId: randomUUID(), email: dto.email };
    return {
      accessToken: await this.jwt.signAsync(claims, { expiresIn }),
      expiresIn,
    };
  }

  async validateToken(dto: ValidateTokenDto): Promise<TokenClaims> {
    return { userId: randomUUID(), email: 'stub@example.com' };
  }

  async getUser(dto: GetUserDto): Promise<UserView> {
    return this.stubUser(dto.userId, 'stub@example.com');
  }

  async findByEmail(dto: FindByEmailDto): Promise<UserView> {
    return this.stubUser(randomUUID(), dto.email);
  }
}
