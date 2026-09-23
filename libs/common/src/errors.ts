import { HttpStatus } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';

export const ErrorCode = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  RATE_LIMITED: 'RATE_LIMITED',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  WALLET_NOT_FOUND: 'WALLET_NOT_FOUND',
  TRANSACTION_NOT_FOUND: 'TRANSACTION_NOT_FOUND',
  NOTIFICATION_NOT_FOUND: 'NOTIFICATION_NOT_FOUND',
  EMAIL_TAKEN: 'EMAIL_TAKEN',
  WALLET_EXISTS: 'WALLET_EXISTS',
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  CURRENCY_MISMATCH: 'CURRENCY_MISMATCH',
  WALLET_INACTIVE: 'WALLET_INACTIVE',
  SELF_TRANSFER: 'SELF_TRANSFER',
  PROVIDER_DECLINED: 'PROVIDER_DECLINED',
  PROVIDER_UNAVAILABLE: 'PROVIDER_UNAVAILABLE',
  PROVIDER_TIMEOUT: 'PROVIDER_TIMEOUT',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface RpcErrorPayload {
  code: ErrorCode;
  message: string;
  details?: unknown;
}

/**
 * Thrown inside microservices. Nest serializes the payload and the calling
 * ClientProxy rejects with the plain object — not with this class — so the
 * gateway identifies it structurally via isRpcErrorPayload.
 */
export class AppRpcException extends RpcException {
  constructor(code: ErrorCode, message: string, details?: unknown) {
    const payload: RpcErrorPayload =
      details === undefined ? { code, message } : { code, message, details };
    super(payload);
  }
}

const HTTP_STATUS_BY_CODE: Record<string, number> = {
  [ErrorCode.VALIDATION_FAILED]: HttpStatus.BAD_REQUEST,
  [ErrorCode.UNAUTHORIZED]: HttpStatus.UNAUTHORIZED,
  [ErrorCode.FORBIDDEN]: HttpStatus.FORBIDDEN,
  [ErrorCode.RATE_LIMITED]: HttpStatus.TOO_MANY_REQUESTS,
  [ErrorCode.USER_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [ErrorCode.WALLET_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [ErrorCode.TRANSACTION_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [ErrorCode.NOTIFICATION_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [ErrorCode.EMAIL_TAKEN]: HttpStatus.CONFLICT,
  [ErrorCode.WALLET_EXISTS]: HttpStatus.CONFLICT,
  [ErrorCode.INSUFFICIENT_FUNDS]: HttpStatus.UNPROCESSABLE_ENTITY,
  [ErrorCode.CURRENCY_MISMATCH]: HttpStatus.UNPROCESSABLE_ENTITY,
  [ErrorCode.WALLET_INACTIVE]: HttpStatus.UNPROCESSABLE_ENTITY,
  [ErrorCode.SELF_TRANSFER]: HttpStatus.UNPROCESSABLE_ENTITY,
  [ErrorCode.PROVIDER_DECLINED]: HttpStatus.UNPROCESSABLE_ENTITY,
  [ErrorCode.PROVIDER_UNAVAILABLE]: HttpStatus.BAD_GATEWAY,
  [ErrorCode.SERVICE_UNAVAILABLE]: HttpStatus.BAD_GATEWAY,
  [ErrorCode.PROVIDER_TIMEOUT]: HttpStatus.GATEWAY_TIMEOUT,
  [ErrorCode.NOT_IMPLEMENTED]: HttpStatus.NOT_IMPLEMENTED,
};

export function httpStatusForCode(code: string): number {
  return HTTP_STATUS_BY_CODE[code] ?? HttpStatus.INTERNAL_SERVER_ERROR;
}

export function isRpcErrorPayload(value: unknown): value is RpcErrorPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    !(value instanceof Error) &&
    typeof (value as RpcErrorPayload).code === 'string' &&
    typeof (value as RpcErrorPayload).message === 'string'
  );
}
