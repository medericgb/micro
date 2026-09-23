import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { ThrottlerException } from '@nestjs/throttler';
import { ErrorCode, httpStatusForCode, isRpcErrorPayload } from '@app/common';

/**
 * A microservice throws AppRpcException, but the calling ClientProxy rejects
 * with the serialized payload object, not with the class. So this filter
 * identifies errors structurally rather than by instanceof.
 */
@Catch()
export class RpcExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(RpcExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<{
      status: (code: number) => { json: (body: unknown) => void };
    }>();
    const request = http.getRequest<{ url?: string; correlationId?: string }>();

    const { status, code, message, details } = this.describe(exception);

    if (status >= Number(HttpStatus.INTERNAL_SERVER_ERROR)) {
      this.logger.error(
        `${request?.url ?? 'unknown'} -> ${code}: ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(status).json({
      statusCode: status,
      code,
      message,
      ...(details === undefined ? {} : { details }),
      correlationId: request?.correlationId,
      timestamp: new Date().toISOString(),
    });
  }

  private describe(exception: unknown): {
    status: number;
    code: string;
    message: string;
    details?: unknown;
  } {
    // Raised across the wire: the ClientProxy rejects with the plain payload.
    // Raised locally (the JwtGuard), it is still the RpcException instance, and
    // isRpcErrorPayload rejects Errors — so unwrap it before the structural check.
    const candidate =
      exception instanceof RpcException ? exception.getError() : exception;

    if (isRpcErrorPayload(candidate)) {
      return {
        status: httpStatusForCode(candidate.code),
        code: candidate.code,
        message: candidate.message,
        details: candidate.details,
      };
    }

    // Before the HttpException branch: ThrottlerException is one, and would
    // otherwise be reported as a 429 labelled VALIDATION_FAILED.
    if (exception instanceof ThrottlerException) {
      return {
        status: httpStatusForCode(ErrorCode.RATE_LIMITED),
        code: ErrorCode.RATE_LIMITED,
        message: 'Too many requests',
      };
    }

    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      return {
        status: exception.getStatus(),
        code: ErrorCode.VALIDATION_FAILED,
        message: exception.message,
        details: typeof body === 'object' ? body : undefined,
      };
    }

    if (exception instanceof Error && exception.name === 'TimeoutError') {
      return {
        status: httpStatusForCode(ErrorCode.PROVIDER_TIMEOUT),
        code: ErrorCode.PROVIDER_TIMEOUT,
        message: 'Downstream service did not respond in time',
      };
    }

    if (
      exception instanceof Error &&
      (exception as NodeJS.ErrnoException).code === 'ECONNREFUSED'
    ) {
      return {
        status: httpStatusForCode(ErrorCode.SERVICE_UNAVAILABLE),
        code: ErrorCode.SERVICE_UNAVAILABLE,
        message: 'Downstream service is not reachable',
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: 'Unexpected error',
    };
  }
}
