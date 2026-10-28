import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../shared/infrastructure/unit-of-work';
import type { DayActivity } from '../domain/daily-quests';
import type { QuestActivityPort } from '../domain/ports';

@Injectable()
export class PrismaQuestActivity implements QuestActivityPort {
  constructor(private readonly uow: UnitOfWork) {}

  async dayActivity(userId: string, from: Date, to: Date): Promise<DayActivity> {
    const db = this.uow.client;
    const rows = await db.$queryRaw<{ lessons: number; perfect: number; accurate: number; reviews: number }[]>`
      SELECT
        COUNT(*) FILTER (WHERE kind = 'lesson')::int AS lessons,
        COUNT(*) FILTER (WHERE kind = 'lesson' AND cardinality(question_ids) > 0 AND correct_count = cardinality(question_ids))::int AS perfect,
        COUNT(*) FILTER (WHERE kind = 'lesson' AND cardinality(question_ids) > 0 AND correct_count::float / cardinality(question_ids) >= 0.9)::int AS accurate,
        COUNT(*) FILTER (WHERE kind = 'review')::int AS reviews
      FROM lesson_sessions
      WHERE user_id = ${userId}::uuid AND finished_at >= ${from} AND finished_at < ${to}`;
    const xp = await db.xpEvent.aggregate({
      _sum: { amount: true },
      where: { userId, createdAt: { gte: from, lt: to }, reason: { not: 'quest' } },
    });
    const r = rows[0] ?? { lessons: 0, perfect: 0, accurate: 0, reviews: 0 };
    return { lessons: r.lessons, perfect: r.perfect, accurate: r.accurate, reviews: r.reviews, xpExcludingQuest: xp._sum.amount ?? 0 };
  }

  async dailyGoalOf(userId: string): Promise<number> {
    const u = await this.uow.client.user.findUniqueOrThrow({ where: { id: userId }, select: { dailyGoal: true } });
    return u.dailyGoal;
  }
}
