import { Logger } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { UnitOfWork } from '../../../../shared/infrastructure/unit-of-work';
import { AnswerGraded } from '../../../learning/domain/events';
import { FAST_THRESHOLD_MS, nextReview, qualityOf } from '../../domain/sm2';

/**
 * Learning의 AnswerGraded를 구독해 review_items를 UPSERT.
 * - 처음 보는 문제: 오답이면 내일, 정답이면 1일 간격으로 큐에 들어감
 * - 이미 있는 문제: SM-2로 다음 간격 계산
 * 자기 트랜잭션에서 실행(최종 일관성). 실패해도 Learning 트랜잭션은 이미 커밋됨 — 로그만 남김.
 */
@EventsHandler(AnswerGraded)
export class ScheduleReviewOnAnswerGraded implements IEventHandler<AnswerGraded> {
  private readonly logger = new Logger(ScheduleReviewOnAnswerGraded.name);
  constructor(private readonly uow: UnitOfWork) {}

  async handle(e: AnswerGraded) {
    const { userId, questionId, isCorrect, timeMs } = e.payload;
    try {
      await this.uow.run(async () => {
        const db = this.uow.client;
        const q = await db.question.findUnique({ where: { id: questionId }, select: { type: true } });
        if (!q) return;
        const quality = qualityOf(isCorrect, timeMs, FAST_THRESHOLD_MS[q.type] ?? 15_000);
        const existing = await db.reviewItem.findUnique({ where: { userId_questionId: { userId, questionId } } });
        const state = existing
          ? { easeFactor: Number(existing.easeFactor), intervalDays: existing.intervalDays, repetitions: existing.repetitions }
          : { easeFactor: 2.5, intervalDays: 0, repetitions: 0 };
        const next = nextReview(state, quality, e.occurredAt);
        await db.reviewItem.upsert({
          where: { userId_questionId: { userId, questionId } },
          create: { userId, questionId, easeFactor: next.easeFactor, intervalDays: next.intervalDays, repetitions: next.repetitions, dueAt: next.dueAt, lastReviewedAt: e.occurredAt },
          update: { easeFactor: next.easeFactor, intervalDays: next.intervalDays, repetitions: next.repetitions, dueAt: next.dueAt, lastReviewedAt: e.occurredAt },
        });
      });
    } catch (err) {
      this.logger.error(`review schedule failed user=${userId} q=${questionId}: ${(err as Error).message}`);
    }
  }
}
