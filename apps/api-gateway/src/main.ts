import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { randomUUID } from 'node:crypto';
import helmet from 'helmet';
import type { Request, Response, NextFunction } from 'express';
import { ApiGatewayModule } from './api-gateway.module';
import { RpcExceptionFilter } from './filters/rpc-exception.filter';
import { corsOptions } from './security.config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(ApiGatewayModule);

  app.use(helmet());

  // No CORS_ORIGINS means no cross-origin access, rather than any origin.
  const cors = corsOptions();
  if (cors !== false) {
    app.enableCors(cors);
  }

  app.use(
    (
      req: Request & { correlationId?: string },
      res: Response,
      next: NextFunction,
    ) => {
      req.correlationId =
        (req.headers['x-correlation-id'] as string) ?? randomUUID();
      res.setHeader('x-correlation-id', req.correlationId);
      next();
    },
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new RpcExceptionFilter());

  await app.listen(Number(process.env.GATEWAY_PORT ?? 3000));
}
void bootstrap();
