import {
  AUTH_PATTERNS,
  WALLET_PATTERNS,
  NOTIFICATION_PATTERNS,
  MOMO_PATTERNS,
  HEALTH_PATTERNS,
  ALL_PATTERNS,
} from './patterns';

describe('patterns', () => {
  it('namespaces every pattern by its owning service', () => {
    Object.values(AUTH_PATTERNS).forEach((p) => expect(p).toMatch(/^auth\./));
    Object.values(WALLET_PATTERNS).forEach((p) =>
      expect(p).toMatch(/^wallet\./),
    );
    Object.values(NOTIFICATION_PATTERNS).forEach((p) =>
      expect(p).toMatch(/^notification\./),
    );
    Object.values(MOMO_PATTERNS).forEach((p) => expect(p).toMatch(/^momo\./));
  });

  it('has no duplicate pattern strings across services', () => {
    expect(new Set(ALL_PATTERNS).size).toBe(ALL_PATTERNS.length);
  });

  it('defines a health pattern for every service token', () => {
    expect(HEALTH_PATTERNS).toEqual({
      AUTH_SERVICE: 'auth.health',
      WALLET_SERVICE: 'wallet.health',
      NOTIFICATION_SERVICE: 'notification.health',
      MOMO_SERVICE: 'momo.health',
    });
  });
});
