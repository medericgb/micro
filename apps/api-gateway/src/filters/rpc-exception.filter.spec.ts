import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { AppRpcException, ErrorCode } from '@app/common';
import { RpcExceptionFilter } from './rpc-exception.filter';

function hostWithResponse() {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ url: '/wallets', correlationId: 'cid-1' }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('RpcExceptionFilter', () => {
  it('maps a structured rpc payload to its http status', () => {
    const { host, status, json } = hostWithResponse();

    new RpcExceptionFilter().catch(
      { code: 'INSUFFICIENT_FUNDS', message: 'Balance too low' },
      host,
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        code: 'INSUFFICIENT_FUNDS',
        message: 'Balance too low',
        correlationId: 'cid-1',
      }),
    );
  });

  it('maps a locally thrown AppRpcException, as the JwtGuard raises', () => {
    const { host, status, json } = hostWithResponse();

    new RpcExceptionFilter().catch(
      new AppRpcException(ErrorCode.UNAUTHORIZED, 'Invalid or expired token'),
      host,
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired token',
      }),
    );
  });

  it('maps an unrecognised code to 500', () => {
    const { host, status } = hostWithResponse();
    new RpcExceptionFilter().catch({ code: 'WAT', message: 'unknown' }, host);
    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
  });

  it('maps a client timeout to 504', () => {
    const { host, status, json } = hostWithResponse();
    const timeout = new Error('Timeout has occurred');
    timeout.name = 'TimeoutError';

    new RpcExceptionFilter().catch(timeout, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.GATEWAY_TIMEOUT);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'PROVIDER_TIMEOUT' }),
    );
  });

  it('maps a refused connection to 502', () => {
    const { host, status, json } = hostWithResponse();
    const refused = Object.assign(new Error('connect ECONNREFUSED'), {
      code: 'ECONNREFUSED',
    });

    new RpcExceptionFilter().catch(refused, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_GATEWAY);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'SERVICE_UNAVAILABLE' }),
    );
  });
});
