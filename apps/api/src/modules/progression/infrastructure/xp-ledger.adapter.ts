import { Injectable } from '@nestjs/common';
import { localDateOf } from '../../../shared/domain/local-date';
import { UnitOfWork } from '../../../shared/infrastructure/unit-of-work';
import type { XpLedgerPort } from '../../quests/domain/ports';

/** Quests가 쓰는 XpLedgerPort의 Progression 측 구현. 현재 UnitOfWork 트랜잭션에 합류한다. lessonsCompleted는 건드리지 않는다. */
@Injectable()
export class XpLedgerAdapter implements XpLedgerPort {
  constructor(private readonly uow: UnitOfWork) {}

  async credit({ userId, amount, reason, at }: { userId: string; amount: number; reason: 'quest'; at: Date }): Promise<void> {
    const db = this.uow.client;
    const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { timezone: true } });
    const date = new Date(`${localDateOf(at, user.timezone)}T00:00:00Z`);
    await db.xpEvent.create({ data: { userId, amount, reason, createdAt: at } });
    await db.userStats.upsert({ where: { userId }, create: { userId, totalXp: amount }, update: { totalXp: { increment: amount } } });
    await db.dailyActivity.upsert({
      where: { userId_activityDate: { userId, activityDate: date } },
      create: { userId, activityDate: date, xp: amount },
      update: { xp: { increment: amount } },
    });
  }
}
