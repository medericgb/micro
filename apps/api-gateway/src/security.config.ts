import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import type { Throttle, ThrottlerModuleOptions } from '@nestjs/throttler';

/**
 * Edge policy is described in exactly one file, the way transport config is.
 * The gateway is the only public surface, so these are the only limits that
 * face the internet. Values are read once at boot, from the environment.
 */

const MINUTE_MS = 60_000;

/** The shape @Throttle accepts; the interface itself is not exported. */
type ThrottleOptions = Parameters<typeof Throttle>[0];

function readInt(key: string, fallback: number): number {
  const value = process.env[key];
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/** Applied to every route, authenticated or not, by the global ThrottlerGuard. */
export function globalThrottle(): ThrottlerModuleOptions {
  return {
    throttlers: [
      {
        name: 'default',
        ttl: readInt('THROTTLE_TTL_MS', MINUTE_MS),
        limit: readInt('THROTTLE_LIMIT', 120),
      },
    ],
  };
}

/**
 * A tighter budget for the two endpoints that take no token: they are the ones
 * an attacker can hammer for free, and login is the credential-stuffing target.
 */
export function authThrottle(): ThrottleOptions {
  return {
    default: {
      ttl: readInt('THROTTLE_AUTH_TTL_MS', MINUTE_MS),
      limit: readInt('THROTTLE_AUTH_LIMIT', 10),
    },
  };
}

/**
 * An empty origin list means no cross-origin browser access at all. A payments
 * gateway that defaults to `*` is one forgotten variable away from letting any
 * page on the internet spend a signed-in user's balance, so the permissive case
 * has to be the one you opt into.
 */
export function corsOptions(): CorsOptions | false {
  const origins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (origins.length === 0) {
    return false;
  }

  return {
    origin: origins,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-Id'],
    exposedHeaders: ['X-Correlation-Id'],
    credentials: false,
    maxAge: 600,
  };
}
