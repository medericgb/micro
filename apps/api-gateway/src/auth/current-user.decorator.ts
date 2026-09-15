import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { TokenClaims } from '@app/contracts';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): TokenClaims => {
    return context.switchToHttp().getRequest<{ user: TokenClaims }>().user;
  },
);
