import { Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { STREAK } from '@cs-daily/contracts';
import { addDaysToLocalDate, localDateOf } from '../../../../shared/domain/local-date';
import { UnitOfWork } from '../../../../shared/infrastructure/unit-of-work';
import { applyMissedDay } from '../../domain/streak';
import { ApplyMissedDaysCommand, RefillFreezesCommand } from './commands';

/**
 * 매일 03:00 UTC 슬롯. 스트릭이 살아 있는 사용자 중 "사용자 로컬 기준 어제"를 놓친 사람에게
 * 프리즈를 소모하거나 스트릭을 0으로. 사용자별 트랜잭션이라 중간 실패해도 재실행 안전.
 */
@CommandHandler(ApplyMissedDaysCommand)
export class ApplyMissedDaysHandler implements ICommandHandler<ApplyMissedDaysCommand, { frozen: number; reset: number }> {
  private readonly logger = new Logger(ApplyMissedDaysHandler.name);
  constructor(private readonly uow: UnitOfWork) {}

  async execute({ now }: ApplyMissedDaysCommand) {
    const db = this.uow.client;
    const users = await db.userStats.findMany({
      where: { currentStreak: { gt: 0 } },
      select: { userId: true, currentStreak: true, longestStreak: true, lastActiveDate: true, freezeCount: true, user: { select: { timezone: true } } },
    });
    let frozen = 0;
    let reset = 0;
    for (const u of users) {
      const yesterday = addDaysToLocalDate(localDateOf(now, u.user.timezone), -1);
      const change = applyMissedDay(
        { current: u.currentStreak, longest: u.longestStreak, lastActiveDate: u.lastActiveDate?.toISOString().slice(0, 10) ?? null, freezeCount: u.freezeCount },
        yesterday,
      );
      if (!change) continue;
      await this.uow.run(async () => {
        const tx = this.uow.client;
        await tx.userStats.update({
          where: { userId: u.userId },
          data: {
            currentStreak: change.next.current,
            freezeCount: change.next.freezeCount,
            lastActiveDate: change.next.lastActiveDate ? new Date(`${change.next.lastActiveDate}T00:00:00Z`) : null,
          },
        });
        if (change.kind === 'freeze') {
          await tx.dailyActivity.upsert({
            where: { userId_activityDate: { userId: u.userId, activityDate: new Date(`${yesterday}T00:00:00Z`) } },
            create: { userId: u.userId, activityDate: new Date(`${yesterday}T00:00:00Z`), usedFreeze: true },
            update: { usedFreeze: true },
          });
        }
      });
      if (change.kind === 'freeze') frozen += 1;
      else reset += 1;
    }
    this.logger.log(`missed-day: frozen=${frozen} reset=${reset}`);
    return { frozen, reset };
  }
}

/** 매월 1일 슬롯: 프리즈를 2개로 충전 (초과 보유분은 유지하지 않음) */
@CommandHandler(RefillFreezesCommand)
export class RefillFreezesHandler implements ICommandHandler<RefillFreezesCommand, { updated: number }> {
  constructor(private readonly uow: UnitOfWork) {}
  async execute() {
    const r = await this.uow.client.userStats.updateMany({ where: { freezeCount: { lt: STREAK.FREEZES_PER_MONTH } }, data: { freezeCount: STREAK.FREEZES_PER_MONTH } });
    return { updated: r.count };
  }
}
