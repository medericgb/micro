import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  ChargeDto,
  PayoutDto,
  ProviderStatusDto,
  ProviderResult,
} from '@app/contracts';

/**
 * Skeleton stub. Milestone 3 replaces these bodies with the MSISDN-suffix
 * behaviour table from the spec (00 declined, 99 timeout, 11 pending) and
 * per-account balance enforcement, backed by PrismaService.
 */
@Injectable()
export class MomoService {
  async charge(dto: ChargeDto): Promise<ProviderResult> {
    return { providerRef: `chg_${randomUUID()}`, outcome: 'SUCCESS', reason: null };
  }

  async payout(dto: PayoutDto): Promise<ProviderResult> {
    return { providerRef: `pay_${randomUUID()}`, outcome: 'SUCCESS', reason: null };
  }

  async status(dto: ProviderStatusDto): Promise<ProviderResult> {
    return { providerRef: dto.providerRef, outcome: 'SUCCESS', reason: null };
  }
}
