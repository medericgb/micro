import { Transport } from '@nestjs/microservices';
import {
  endpointFor,
  microserviceOptions,
  clientOptions,
  rpcTimeoutMs,
} from './transport.config';

describe('transport.config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.AUTH_HOST;
    delete process.env.AUTH_PORT;
    delete process.env.RPC_TIMEOUT_MS;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('falls back to documented defaults', () => {
    expect(endpointFor('AUTH_SERVICE')).toEqual({
      host: 'localhost',
      port: 4001,
    });
    expect(endpointFor('WALLET_SERVICE')).toEqual({
      host: 'localhost',
      port: 4002,
    });
    expect(endpointFor('NOTIFICATION_SERVICE')).toEqual({
      host: 'localhost',
      port: 4003,
    });
    expect(endpointFor('MOMO_SERVICE')).toEqual({
      host: 'localhost',
      port: 4004,
    });
  });

  it('reads the environment at call time, not at import time', () => {
    process.env.AUTH_HOST = 'auth-service';
    process.env.AUTH_PORT = '5001';
    expect(endpointFor('AUTH_SERVICE')).toEqual({
      host: 'auth-service',
      port: 5001,
    });
  });

  it('ignores a non-numeric port and uses the default', () => {
    process.env.AUTH_PORT = 'not-a-port';
    expect(endpointFor('AUTH_SERVICE').port).toBe(4001);
  });

  it('builds TCP listener options', () => {
    expect(microserviceOptions('MOMO_SERVICE')).toEqual({
      transport: Transport.TCP,
      options: { host: 'localhost', port: 4004 },
    });
  });

  it('builds client options carrying the injection token as name', () => {
    expect(clientOptions('WALLET_SERVICE')).toEqual({
      name: 'WALLET_SERVICE',
      transport: Transport.TCP,
      options: { host: 'localhost', port: 4002 },
    });
  });

  it('defaults the rpc timeout to 5000ms and honours an override', () => {
    expect(rpcTimeoutMs()).toBe(5000);
    process.env.RPC_TIMEOUT_MS = '250';
    expect(rpcTimeoutMs()).toBe(250);
  });
});
