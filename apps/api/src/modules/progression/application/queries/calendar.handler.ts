import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { UnitOfWork } from '../../../../shared/infrastructure/unit-of-work';

export class GetCalendarQuery {
  constructor(
    readonly userId: string,
    /** YYYY-MM */
    readonly month: string,
  ) {}
}

/** 프로필의 스트릭 캘린더. daily_activity 원장을 그대로 읽는다 */
@QueryHandler(GetCalendarQuery)
export class GetCalendarHandler implements IQueryHandler<GetCalendarQuery> {
  constructor(private readonly uow: UnitOfWork) {}

  async execute(q: GetCalendarQuery) {
    const db = this.uow.client;
    const user = await db.user.findUniqueOrThrow({ where: { id: q.userId }, select: { dailyGoal: true } });
    const start = new Date(`${q.month}-01T00:00:00Z`);
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    const rows = await db.dailyActivity.findMany({
      where: { userId: q.userId, activityDate: { gte: start, lt: end } },
      orderBy: { activityDate: 'asc' },
    });
    return {
      month: q.month,
      days: rows.map((r) => ({
        date: r.activityDate.toISOString().slice(0, 10),
        xp: r.xp,
        achieved: r.lessonsCompleted >= user.dailyGoal || r.usedFreeze,
        usedFreeze: r.usedFreeze,
      })),
    };
  }
}
