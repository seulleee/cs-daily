import { Module } from '@nestjs/common';
import { CurriculumModule } from '../curriculum/curriculum.module';
import { IdentityModule } from '../identity/identity.module';
import { ReviewModule } from '../review/review.module';
import { CompleteSessionHandler } from './application/commands/complete-session.handler';
import { StartLessonSessionHandler } from './application/commands/start-lesson-session.handler';
import { StartReviewSessionHandler } from './application/commands/start-review-session.handler';
import { StartUnitSkipTestHandler } from './application/commands/start-unit-skip-test.handler';
import { RetryAnswerHandler } from './application/commands/retry-answer.handler';
import { SubmitAnswerHandler } from './application/commands/submit-answer.handler';
import { GetSessionHandler } from './application/queries/get-session.handler';
import { LESSON_SESSION_REPO } from './domain/ports';
import { Grader } from './domain/services/grader';
import { PrismaLessonSessionRepository } from './infrastructure/persistence/prisma-lesson-session.repository';
import { SessionsController } from './presentation/sessions.controller';

/**
 * Learning 컨텍스트. 다른 컨텍스트는 포트 토큰(QUESTION_GRADING_PORT 등)으로만 주입받는다.
 * Curriculum/Identity/Review 모듈이 그 토큰의 구현체를 export한다.
 */
@Module({
  imports: [CurriculumModule, IdentityModule, ReviewModule],
  controllers: [SessionsController],
  providers: [
    Grader,
    { provide: LESSON_SESSION_REPO, useClass: PrismaLessonSessionRepository },
    StartLessonSessionHandler,
    StartReviewSessionHandler,
    StartUnitSkipTestHandler,
    SubmitAnswerHandler,
    RetryAnswerHandler,
    CompleteSessionHandler,
    GetSessionHandler,
  ],
})
export class LearningModule {}
