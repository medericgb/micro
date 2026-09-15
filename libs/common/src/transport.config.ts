import {
  ClientProviderOptions,
  MicroserviceOptions,
  Transport,
} from '@nestjs/microservices';

export type ServiceName =
  | 'AUTH_SERVICE'
  | 'WALLET_SERVICE'
  | 'NOTIFICATION_SERVICE'
  | 'MOMO_SERVICE';

interface EndpointDefaults {
  hostVar: string;
  portVar: string;
  port: number;
}

const DEFAULTS: Record<ServiceName, EndpointDefaults> = {
  AUTH_SERVICE: { hostVar: 'AUTH_HOST', portVar: 'AUTH_PORT', port: 4001 },
  WALLET_SERVICE: { hostVar: 'WALLET_HOST', portVar: 'WALLET_PORT', port: 4002 },
  NOTIFICATION_SERVICE: {
    hostVar: 'NOTIFICATION_HOST',
    portVar: 'NOTIFICATION_PORT',
    port: 4003,
  },
  MOMO_SERVICE: { hostVar: 'MOMO_HOST', portVar: 'MOMO_PORT', port: 4004 },
};

function readString(key: string, fallback: string): string {
  const value = process.env[key];
  return value && value.length > 0 ? value : fallback;
}

function readInt(key: string, fallback: number): number {
  const value = process.env[key];
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
}

/** Read at call time so ConfigModule and tests can influence the result. */
export function endpointFor(name: ServiceName): { host: string; port: number } {
  const spec = DEFAULTS[name];
  return {
    host: readString(spec.hostVar, 'localhost'),
    port: readInt(spec.portVar, spec.port),
  };
}

export function microserviceOptions(name: ServiceName): MicroserviceOptions {
  return { transport: Transport.TCP, options: endpointFor(name) };
}

export function clientOptions(name: ServiceName): ClientProviderOptions {
  return { name, transport: Transport.TCP, options: endpointFor(name) };
}

export function rpcTimeoutMs(): number {
  return readInt('RPC_TIMEOUT_MS', 5000);
}
