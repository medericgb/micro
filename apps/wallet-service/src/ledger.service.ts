import { Injectable } from '@nestjs/common';
import type { HistoryDto, HistoryPage } from '@app/contracts';

/** Skeleton stub. Milestone 5 replaces this with cursor-paginated queries. */
@Injectable()
export class LedgerService {
  async history(dto: HistoryDto): Promise<HistoryPage> {
    return { items: [], nextCursor: null };
  }
}
