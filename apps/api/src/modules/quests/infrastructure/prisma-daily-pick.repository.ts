import { Injectable } from '@nestjs/common';
import type { QuestKey } from '@cs-daily/contracts';
import { UnitOfWork } from '../../../shared/infrastructure/unit-of-work';
import type { DailyPickRepository } from '../domain/ports';

@Injectable()
export class PrismaDailyPickRepository implements DailyPickRepository {
  constructor(private readonly uow: UnitOfWork) {}

  /** 없을 때만 계산해 ON CONFLICT DO NOTHING으로 넣고, 넣은 뒤 다시 읽어 동시 요청 중 먼저 들어간 값을 쓴다. */
  async getOrCreate(userId: string, period: string, compute: () => Promise<QuestKey[]>): Promise<QuestKey[]> {
    const db = this.uow.client;
    const where = { userId_period: { userId, period: new Date(`${period}T00:00:00Z`) } };
    const existing = await db.dailyQuestPick.findUnique({ where });
    if (existing) return existing.keys as QuestKey[];
    const keys = await compute();
    await db.dailyQuestPick.createMany({ data: [{ userId, period: where.userId_period.period, keys }], skipDuplicates: true });
    const stored = await db.dailyQuestPick.findUniqueOrThrow({ where });
    return stored.keys as QuestKey[];
  }
}
