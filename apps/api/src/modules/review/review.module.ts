import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { REVIEW_QUEUE_PORT } from '../learning/domain/ports';
import { ScheduleReviewOnAnswerGraded } from './application/events/schedule-review-on-answer-graded.handler';
import { CountDueReviewsHandler, GetReviewDueHandler } from './application/queries/review-due.handlers';
import { ReviewQueueAdapter } from './infrastructure/review-queue.adapter';
import { ReviewController } from './presentation/review.controller';

/** Review 컨텍스트: SM-2 복습 큐. AnswerGraded 구독, Learning에 ReviewQueuePort 제공 */
@Module({
  imports: [IdentityModule],
  controllers: [ReviewController],
  providers: [ReviewQueueAdapter, { provide: REVIEW_QUEUE_PORT, useExisting: ReviewQueueAdapter }, ScheduleReviewOnAnswerGraded, CountDueReviewsHandler, GetReviewDueHandler],
  exports: [REVIEW_QUEUE_PORT],
})
export class ReviewModule {}
