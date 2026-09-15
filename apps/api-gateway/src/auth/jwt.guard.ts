import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AppRpcException, ErrorCode } from '@app/common';
import type { TokenClaims } from '@app/contracts';

@Injectable()
export class JwtGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: TokenClaims;
    }>();

    const header = request.headers.authorization ?? '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw new AppRpcException(ErrorCode.UNAUTHORIZED, 'Missing bearer token');
    }

    try {
      request.user = await this.jwt.verifyAsync<TokenClaims>(token);
      return true;
    } catch {
      throw new AppRpcException(
        ErrorCode.UNAUTHORIZED,
        'Invalid or expired token',
      );
    }
  }
}
