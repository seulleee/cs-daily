import { Inject } from '@nestjs/common';
import { CommandHandler, EventPublisher, ICommandHandler } from '@nestjs/cqrs';
import { LessonId, QuestionId, UserId } from '../../../../shared/domain/ids';
import { UnitOfWork } from '../../../../shared/infrastructure/unit-of-work';
import { LessonHasNoQuestions, LessonLocked } from '../../domain/errors';
import { LessonSession } from '../../domain/lesson-session.aggregate';
import {
  CURRICULUM_QUERY_PORT,
  LESSON_SESSION_REPO,
  REVIEW_QUEUE_PORT,
  type CurriculumQueryPort,
  type LessonSessionRepository,
  type ReviewQueuePort,
} from '../../domain/ports';
import { StartLessonSessionCommand } from './commands';
import { ErrorCode } from '@cs-daily/contracts';
import { NotFoundError } from '../../../../shared/domain/domain-error';

/** 레슨 끝에 덧붙이는 복습 문제 최대 수 (기획서 8.1 ③) */
const REVIEW_TAIL = 3;

/**
 * 기획서 8.1 데일리 레슨 출제.
 * 미완료 세션이 있으면 그걸 돌려주고(이어 풀기), 없으면 새 세션을 만든다.
 */
@CommandHandler(StartLessonSessionCommand)
export class StartLessonSessionHandler implements ICommandHandler<StartLessonSessionCommand, { sessionId: string; resumed: boolean }> {
  constructor(
    @Inject(LESSON_SESSION_REPO) private readonly sessions: LessonSessionRepository,
    @Inject(CURRICULUM_QUERY_PORT) private readonly curriculum: CurriculumQueryPort,
    @Inject(REVIEW_QUEUE_PORT) private readonly reviews: ReviewQueuePort,
    private readonly uow: UnitOfWork,
    private readonly publisher: EventPublisher,
  ) {}

  async execute(cmd: StartLessonSessionCommand) {
    const userId = UserId.of(cmd.userId);
    const lessonId = LessonId.of(cmd.lessonId);

    const result = await this.uow.run(async () => {
      const open = await this.sessions.findOpen(userId, lessonId);
      if (open) return { session: open, resumed: true };

      const outline = await this.curriculum.lessonOutline(lessonId);
      if (!outline) throw new NotFoundError(ErrorCode.LESSON_NOT_FOUND, `레슨이 없습니다: ${cmd.lessonId}`);
      if (!(await this.curriculum.isLessonUnlocked(userId, lessonId))) throw new LessonLocked(cmd.lessonId);

      const published = await this.curriculum.publishedQuestionIds(lessonId);
      if (published.length === 0) throw new LessonHasNoQuestions(cmd.lessonId);
      const main = published.slice(0, outline.questionCount);

      // 레슨 끝에 복습 예정 문제를 최대 3개 덧붙인다 (중복 제외)
      const due = await this.reviews.dueQuestionIds(userId, REVIEW_TAIL + main.length, new Date());
      const tail = due.filter((id) => !main.includes(id)).slice(0, REVIEW_TAIL);

      const session = LessonSession.start({
        userId,
        kind: 'lesson',
        lessonId,
        questionIds: [...main, ...tail].map(QuestionId.of),
        reviewQuestionIds: tail,
      });
      await this.sessions.save(session);
      return { session, resumed: false };
    });

    if (!result.resumed) this.publisher.mergeObjectContext(result.session).commit();
    return { sessionId: result.session.id.value, resumed: result.resumed };
  }
}
