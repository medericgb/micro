import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  MOMO_PATTERNS,
  ChargeDto,
  PayoutDto,
  ProviderStatusDto,
  type ProviderResult,
  type HealthReport,
} from '@app/contracts';
import { MomoService } from './momo.service';

/** Handlers unwrap the payload and delegate. No business logic lives here. */
@Controller()
export class MomoController {
  constructor(private readonly momo: MomoService) {}

  @MessagePattern(MOMO_PATTERNS.health)
  health(): HealthReport {
    return { service: 'momo-sim', status: 'ok' };
  }

  @MessagePattern(MOMO_PATTERNS.charge)
  charge(@Payload() dto: ChargeDto): Promise<ProviderResult> {
    return this.momo.charge(dto);
  }

  @MessagePattern(MOMO_PATTERNS.payout)
  payout(@Payload() dto: PayoutDto): Promise<ProviderResult> {
    return this.momo.payout(dto);
  }

  @MessagePattern(MOMO_PATTERNS.status)
  status(@Payload() dto: ProviderStatusDto): Promise<ProviderResult> {
    return this.momo.status(dto);
  }
}
