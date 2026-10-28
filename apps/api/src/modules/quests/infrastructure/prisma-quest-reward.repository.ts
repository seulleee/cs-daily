import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../shared/infrastructure/unit-of-work';
import type { QuestRewardRepository } from '../domain/ports';

@Injectable()
export class PrismaQuestRewardRepository implements QuestRewardRepository {
  constructor(private readonly uow: UnitOfWork) {}

  /** ON CONFLICT DO NOTHING — 중복 INSERT 오류가 바깥 트랜잭션을 망치지 않는다. */
  async tryInsert(r: { userId: string; questKey: string; period: string; xp: number }): Promise<boolean> {
    const res = await this.uow.client.questReward.createMany({
      data: [{ userId: r.userId, questKey: r.questKey, period: new Date(`${r.period}T00:00:00Z`), xp: r.xp }],
      skipDuplicates: true,
    });
    return res.count === 1;
  }
}
