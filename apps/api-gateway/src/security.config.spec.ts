import { authThrottle, corsOptions, globalThrottle } from './security.config';

describe('security.config', () => {
  const saved = process.env;

  beforeEach(() => {
    process.env = { ...saved };
  });

  afterAll(() => {
    process.env = saved;
  });

  describe('corsOptions', () => {
    it('denies cross-origin access when no origin is configured', () => {
      delete process.env.CORS_ORIGINS;
      expect(corsOptions()).toBe(false);
    });

    it('treats an empty or whitespace-only list as no origins', () => {
      process.env.CORS_ORIGINS = ' , ,';
      expect(corsOptions()).toBe(false);
    });

    it('allows exactly the configured origins', () => {
      process.env.CORS_ORIGINS = 'https://app.payflow.test, https://admin.test';
      expect(corsOptions()).toMatchObject({
        origin: ['https://app.payflow.test', 'https://admin.test'],
        credentials: false,
      });
    });

    it('exposes the correlation id so a browser client can read it back', () => {
      process.env.CORS_ORIGINS = 'https://app.payflow.test';
      const options = corsOptions();
      expect(options).not.toBe(false);
      expect(options).toMatchObject({ exposedHeaders: ['X-Correlation-Id'] });
    });
  });

  describe('throttles', () => {
    it('falls back to one minute windows', () => {
      delete process.env.THROTTLE_LIMIT;
      delete process.env.THROTTLE_AUTH_LIMIT;

      expect(globalThrottle()).toEqual({
        throttlers: [{ name: 'default', ttl: 60_000, limit: 120 }],
      });
      expect(authThrottle()).toEqual({
        default: { ttl: 60_000, limit: 10 },
      });
    });

    it('is tighter on the unauthenticated routes than globally', () => {
      const [global] = (globalThrottle() as { throttlers: { limit: number }[] })
        .throttlers;
      expect(authThrottle().default.limit).toBeLessThan(global.limit);
    });

    it('reads overrides from the environment', () => {
      process.env.THROTTLE_LIMIT = '5';
      process.env.THROTTLE_AUTH_TTL_MS = '900000';

      expect(globalThrottle()).toMatchObject({
        throttlers: [expect.objectContaining({ limit: 5 })],
      });
      expect(authThrottle().default.ttl).toBe(900_000);
    });

    it('ignores a value that is not a positive integer', () => {
      process.env.THROTTLE_LIMIT = 'nope';
      expect(globalThrottle()).toMatchObject({
        throttlers: [expect.objectContaining({ limit: 120 })],
      });

      process.env.THROTTLE_LIMIT = '-5';
      expect(globalThrottle()).toMatchObject({
        throttlers: [expect.objectContaining({ limit: 120 })],
      });
    });
  });
});
