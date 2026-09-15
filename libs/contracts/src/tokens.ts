import type { ServiceName } from '@app/common';

/** Injection tokens for ClientsModule. Identical to the ServiceName union. */
export const SERVICE_TOKENS: Record<ServiceName, ServiceName> = {
  AUTH_SERVICE: 'AUTH_SERVICE',
  WALLET_SERVICE: 'WALLET_SERVICE',
  NOTIFICATION_SERVICE: 'NOTIFICATION_SERVICE',
  MOMO_SERVICE: 'MOMO_SERVICE',
};

export type { ServiceName };

export interface HealthReport {
  service: string;
  status: 'ok';
}
