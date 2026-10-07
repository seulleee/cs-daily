import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { LessonId, QuestionId, SessionId, UserId } from '../../../../shared/domain/ids';
import { UnitOfWork } from '../../../../shared/infrastructure/unit-of-work';
import { Answer } from '../../domain/answer.entity';
import { LessonSession } from '../../domain/lesson-session.aggregate';
import type { LessonSessionRepository } from '../../domain/ports';
import type { SessionKind } from '../../domain/services/session-kind';

type Row = Prisma.LessonSessionGetPayload<{ include: { answers: true } }>;

/**
 * Prisma 모델(영속 스키마) ↔ LessonSession(도메인 모델) 매핑.
 * 건너뛰기(placement) 세션은 유닛의 마지막 레슨 id를 lesson_id로 저장한다.
 * 복습 꼬리 문제는 별도 컬럼 없이 "review 세션이거나, lesson 세션에서 question_count를 넘는 뒤쪽 문제"로 복원한다.
 */
@Injectable()
export class PrismaLessonSessionRepository implements LessonSessionRepository {
  constructor(private readonly uow: UnitOfWork) {}

  private get db() {
    return this.uow.client;
  }

  async findById(id: SessionId): Promise<LessonSession | null> {
    const row = await this.db.lessonSession.findUnique({ where: { id: id.value }, include: { answers: true, lesson: { select: { questionCount: true } } } });
    return row ? this.toDomain(row, row.lesson?.questionCount ?? row.questionIds.length) : null;
  }

  async findOpen(userId: UserId, lessonId?: LessonId, kind?: SessionKind): Promise<LessonSession | null> {
    const row = await this.db.lessonSession.findFirst({
      where: { userId: userId.value, finishedAt: null, ...(lessonId ? { lessonId: lessonId.value } : {}), ...(kind ? { kind } : {}) },
      orderBy: { startedAt: 'desc' },
      include: { answers: true, lesson: { select: { questionCount: true } } },
    });
    return row ? this.toDomain(row, row.lesson?.questionCount ?? row.questionIds.length) : null;
  }

  async save(session: LessonSession): Promise<void> {
    const answers = session.allAnswers();
    await this.db.lessonSession.upsert({
      where: { id: session.id.value },
      create: {
        id: session.id.value,
        userId: session.userId.value,
        lessonId: session.lessonId?.value ?? null,
        kind: session.kind,
        questionIds: session.orderedQuestionIds.map((q) => q.value),
        startedAt: session.startedAt,
        finishedAt: session.finished,
        correctCount: session.correctCount,
        xpEarned: session.earnedXp,
      },
      update: {
        finishedAt: session.finished,
        correctCount: session.correctCount,
        xpEarned: session.earnedXp,
      },
    });
    // answers는 append-only: 아직 저장되지 않은 것만 넣는다 (UNIQUE(session_id, question_id)가 2중 안전장치)
    if (answers.length > 0) {
      await this.db.answer.createMany({
        data: answers.map((a) => ({
          sessionId: session.id.value,
          userId: session.userId.value,
          questionId: a.questionId.value,
          questionVersion: a.questionVersion,
          userAnswer: a.raw as Prisma.InputJsonValue,
          isCorrect: a.isCorrect,
          timeMs: a.timeMs,
          answeredAt: a.answeredAt,
        })),
        skipDuplicates: true,
      });
    }
  }

  async countCompletedToday(userId: UserId, lessonId: LessonId, localDate: string, timeZone: string): Promise<number> {
    // 사용자 로컬 날짜의 [00:00, 24:00) 구간을 UTC로 환산해 조회
    const start = zonedMidnightToUtc(localDate, timeZone);
    const end = new Date(start.getTime() + 86_400_000);
    return this.db.lessonSession.count({
      where: { userId: userId.value, lessonId: lessonId.value, kind: 'lesson', finishedAt: { gte: start, lt: end } },
    });
  }

  private toDomain(row: Row, questionCount: number): LessonSession {
    const ids = row.questionIds;
    const reviewIds = row.kind === 'review' ? ids : row.kind === 'placement' ? [] : ids.slice(questionCount);
    return LessonSession.rehydrate({
      id: SessionId.of(row.id),
      userId: UserId.of(row.userId),
      kind: row.kind,
      lessonId: row.lessonId ? LessonId.of(row.lessonId) : null,
      questionIds: ids.map(QuestionId.of),
      reviewQuestionIds: reviewIds,
      answers: row.answers.map((a) =>
        Answer.rehydrate({
          questionId: QuestionId.of(a.questionId),
          questionVersion: a.questionVersion,
          raw: a.userAnswer,
          isCorrect: a.isCorrect,
          timeMs: a.timeMs ?? 0,
          answeredAt: a.answeredAt,
        }),
      ),
      finishedAt: row.finishedAt,
      xpEarned: row.xpEarned,
      startedAt: row.startedAt,
    });
  }
}

/** "YYYY-MM-DD" 로컬 자정을 해당 타임존 기준 UTC Date로 */
export function zonedMidnightToUtc(localDate: string, timeZone: string): Date {
  const guess = new Date(`${localDate}T00:00:00Z`);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(guess);
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? '0');
  const asIfUtc = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour') % 24, g('minute'), g('second'));
  const offsetMs = asIfUtc - guess.getTime();
  return new Date(guess.getTime() - offsetMs);
}
