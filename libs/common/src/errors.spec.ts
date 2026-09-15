import { HttpStatus } from '@nestjs/common';
import {
  ErrorCode,
  AppRpcException,
  httpStatusForCode,
  isRpcErrorPayload,
} from './errors';

describe('errors', () => {
  it('carries a structured payload through RpcException', () => {
    const error = new AppRpcException(ErrorCode.INSUFFICIENT_FUNDS, 'Balance too low');
    expect(error.getError()).toEqual({
      code: 'INSUFFICIENT_FUNDS',
      message: 'Balance too low',
    });
  });

  it('includes details when supplied', () => {
    const error = new AppRpcException(ErrorCode.VALIDATION_FAILED, 'Bad input', {
      field: 'amount',
    });
    expect(error.getError()).toEqual({
      code: 'VALIDATION_FAILED',
      message: 'Bad input',
      details: { field: 'amount' },
    });
  });

  it.each([
    [ErrorCode.VALIDATION_FAILED, HttpStatus.BAD_REQUEST],
    [ErrorCode.UNAUTHORIZED, HttpStatus.UNAUTHORIZED],
    [ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN],
    [ErrorCode.WALLET_NOT_FOUND, HttpStatus.NOT_FOUND],
    [ErrorCode.EMAIL_TAKEN, HttpStatus.CONFLICT],
    [ErrorCode.INSUFFICIENT_FUNDS, HttpStatus.UNPROCESSABLE_ENTITY],
    [ErrorCode.PROVIDER_DECLINED, HttpStatus.UNPROCESSABLE_ENTITY],
    [ErrorCode.PROVIDER_UNAVAILABLE, HttpStatus.BAD_GATEWAY],
    [ErrorCode.PROVIDER_TIMEOUT, HttpStatus.GATEWAY_TIMEOUT],
  ])('maps %s to %i', (code, status) => {
    expect(httpStatusForCode(code)).toBe(status);
  });

  it('maps an unknown code to 500', () => {
    expect(httpStatusForCode('SOMETHING_NEW')).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
  });

  describe('isRpcErrorPayload', () => {
    it('recognises a structured payload', () => {
      expect(isRpcErrorPayload({ code: 'UNAUTHORIZED', message: 'no' })).toBe(true);
    });

    it('rejects anything else', () => {
      expect(isRpcErrorPayload(null)).toBe(false);
      expect(isRpcErrorPayload('boom')).toBe(false);
      expect(isRpcErrorPayload(new Error('boom'))).toBe(false);
      expect(isRpcErrorPayload({ message: 'no code' })).toBe(false);
    });
  });
});
