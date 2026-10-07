import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UnitOfWork } from '../../../../shared/infrastructure/unit-of-work';
import { extendStreak } from '../../domain/streak';
import { RecordSessionCompletionCommand, type SessionCompletionResult } from './commands';

/**
 * 세션 완료 → XP 원장 append, 일별 활동 UPSERT, 레슨 진행도, 데일리 목표 달성 시 스트릭 연장.
 * 한 트랜잭션. 모든 값은 daily_activity·xp_events 원장에서 재계산 가능하다.
 */
@CommandHandler(RecordSessionCompletionCommand)
export class RecordSessionCompletionHandler implements ICommandHandler<RecordSessionCompletionCommand, SessionCompletionResult> {
  constructor(private readonly uow: UnitOfWork) {}

  async execute({ payload: p }: RecordSessionCompletionCommand): Promise<SessionCompletionResult> {
    return this.uow.run(async () => {
      const db = this.uow.client;
      const user = await db.user.findUniqueOrThrow({ where: { id: p.userId }, select: { dailyGoal: true } });
      const date = new Date(`${p.localDate}T00:00:00Z`);

      // 1. XP 원장 + 집계
      if (p.xpEarned > 0) {
        await db.xpEvent.create({ data: { userId: p.userId, amount: p.xpEarned, reason: p.kind === 'review' ? 'review_session' : 'lesson_session', refId: p.sessionId } });
      }

      // 2. 일별 활동 (복습 세션은 레슨 수에 포함하지 않음 — 데일리 목표는 레슨 기준)
      const lessonsInc = p.kind === 'lesson' ? 1 : 0;
      const activity = await db.dailyActivity.upsert({
        where: { userId_activityDate: { userId: p.userId, activityDate: date } },
        create: { userId: p.userId, activityDate: date, xp: p.xpEarned, lessonsCompleted: lessonsInc },
        update: { xp: { increment: p.xpEarned }, lessonsCompleted: { increment: lessonsInc } },
      });

      // 3. 레슨 진행도 (best score, 완료 시각) — 건너뛰기 테스트는 점수를 남기지 않는다
      if (p.lessonId && p.kind === 'lesson') {
        const score = p.total > 0 ? Math.round((p.correct / p.total) * 100) : 0;
        const prev = await db.userLessonProgress.findUnique({ where: { userId_lessonId: { userId: p.userId, lessonId: p.lessonId } } });
        await db.userLessonProgress.upsert({
          where: { userId_lessonId: { userId: p.userId, lessonId: p.lessonId } },
          create: { userId: p.userId, lessonId: p.lessonId, bestScore: score, completedCount: 1, completedAt: p.occurredAt },
          update: { bestScore: Math.max(prev?.bestScore ?? 0, score), completedCount: { increment: 1 }, completedAt: prev?.completedAt ?? p.occurredAt },
        });
      }

      // 3-1. 건너뛰기 통과: 아직 완료되지 않은 레슨만 완료 처리 (점수 0, 완료 횟수 0 — "건너뜀"으로 구분 가능)
      let skippedLessons = 0;
      for (const lessonId of p.skipLessonIds ?? []) {
        const prev = await db.userLessonProgress.findUnique({ where: { userId_lessonId: { userId: p.userId, lessonId } }, select: { completedAt: true } });
        if (prev?.completedAt) continue;
        await db.userLessonProgress.upsert({
          where: { userId_lessonId: { userId: p.userId, lessonId } },
          create: { userId: p.userId, lessonId, completedAt: p.occurredAt },
          update: { completedAt: p.occurredAt },
        });
        skippedLessons += 1;
      }

      // 4. 스트릭: 데일리 목표를 "오늘 처음" 채운 순간에만 연장
      const stats = await db.userStats.upsert({ where: { userId: p.userId }, create: { userId: p.userId }, update: {} });
      const achieved = activity.lessonsCompleted >= user.dailyGoal;
      let current = stats.currentStreak;
      let extended = false;
      if (achieved) {
        const r = extendStreak(
          { current: stats.currentStreak, longest: stats.longestStreak, lastActiveDate: stats.lastActiveDate ? stats.lastActiveDate.toISOString().slice(0, 10) : null },
          p.localDate,
        );
        current = r.next.current;
        extended = r.extended;
        await db.userStats.update({
          where: { userId: p.userId },
          data: {
            totalXp: { increment: p.xpEarned },
            currentStreak: r.next.current,
            longestStreak: r.next.longest,
            lastActiveDate: r.next.lastActiveDate ? new Date(`${r.next.lastActiveDate}T00:00:00Z`) : null,
          },
        });
      } else if (p.xpEarned > 0) {
        await db.userStats.update({ where: { userId: p.userId }, data: { totalXp: { increment: p.xpEarned } } });
      }

      return {
        skippedLessons,
        streak: { current, extended },
        dailyGoal: { target: user.dailyGoal, done: activity.lessonsCompleted, achieved },
      };
    });
  }
}
