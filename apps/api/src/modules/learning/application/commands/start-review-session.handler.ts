import { Inject } from '@nestjs/common';
import { CommandHandler, EventPublisher, ICommandHandler } from '@nestjs/cqrs';
import { QuestionId, UserId } from '../../../../shared/domain/ids';
import { UnitOfWork } from '../../../../shared/infrastructure/unit-of-work';
import { NoReviewDue } from '../../domain/errors';
import { LessonSession } from '../../domain/lesson-session.aggregate';
import { LESSON_SESSION_REPO, REVIEW_QUEUE_PORT, type LessonSessionRepository, type ReviewQueuePort } from '../../domain/ports';
import { StartReviewSessionCommand } from './commands';

const REVIEW_SESSION_SIZE = 10;

/** 기획서 8.4: 복습 세션은 due_at 오름차순 10개 */
@CommandHandler(StartReviewSessionCommand)
export class StartReviewSessionHandler implements ICommandHandler<StartReviewSessionCommand, { sessionId: string; resumed: boolean }> {
  constructor(
    @Inject(LESSON_SESSION_REPO) private readonly sessions: LessonSessionRepository,
    @Inject(REVIEW_QUEUE_PORT) private readonly reviews: ReviewQueuePort,
    private readonly uow: UnitOfWork,
    private readonly publisher: EventPublisher,
  ) {}

  async execute(cmd: StartReviewSessionCommand) {
    const userId = UserId.of(cmd.userId);
    const result = await this.uow.run(async () => {
      const open = await this.sessions.findOpen(userId);
      if (open && open.kind === 'review') return { session: open, resumed: true };

      const due = await this.reviews.dueQuestionIds(userId, REVIEW_SESSION_SIZE, new Date());
      if (due.length === 0) throw new NoReviewDue();

      const session = LessonSession.start({
        userId,
        kind: 'review',
        lessonId: null,
        questionIds: due.map(QuestionId.of),
        reviewQuestionIds: due,
      });
      await this.sessions.save(session);
      return { session, resumed: false };
    });
    if (!result.resumed) this.publisher.mergeObjectContext(result.session).commit();
    return { sessionId: result.session.id.value, resumed: result.resumed };
  }
}
