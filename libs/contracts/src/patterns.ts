export const AUTH_PATTERNS = {
  health: 'auth.health',
  register: 'auth.register',
  login: 'auth.login',
  validateToken: 'auth.validate_token',
  getUser: 'auth.get_user',
  findByEmail: 'auth.find_by_email',
} as const;

export const WALLET_PATTERNS = {
  health: 'wallet.health',
  create: 'wallet.create',
  list: 'wallet.list',
  getBalance: 'wallet.get_balance',
  deposit: 'wallet.deposit',
  transfer: 'wallet.transfer',
  history: 'wallet.history',
} as const;

export const NOTIFICATION_PATTERNS = {
  health: 'notification.health',
  send: 'notification.send',
  list: 'notification.list',
  markRead: 'notification.mark_read',
} as const;

export const MOMO_PATTERNS = {
  health: 'momo.health',
  charge: 'momo.charge',
  payout: 'momo.payout',
  status: 'momo.status',
} as const;

export const HEALTH_PATTERNS = {
  AUTH_SERVICE: AUTH_PATTERNS.health,
  WALLET_SERVICE: WALLET_PATTERNS.health,
  NOTIFICATION_SERVICE: NOTIFICATION_PATTERNS.health,
  MOMO_SERVICE: MOMO_PATTERNS.health,
} as const;

export const ALL_PATTERNS: string[] = [
  ...Object.values(AUTH_PATTERNS),
  ...Object.values(WALLET_PATTERNS),
  ...Object.values(NOTIFICATION_PATTERNS),
  ...Object.values(MOMO_PATTERNS),
];
