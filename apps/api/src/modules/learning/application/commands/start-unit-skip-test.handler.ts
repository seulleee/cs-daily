import { Inject } from '@nestjs/common';
import { CommandHandler, EventPublisher, ICommandHandler } from '@nestjs/cqrs';
import { LessonId, QuestionId, UserId } from '../../../../shared/domain/ids';
import { UnitOfWork } from '../../../../shared/infrastructure/unit-of-work';
import { LessonHasNoQuestions, UnitNotFound } from '../../domain/errors';
import { LessonSession } from '../../domain/lesson-session.aggregate';
import { CURRICULUM_QUERY_PORT, LESSON_SESSION_REPO, type CurriculumQueryPort, type LessonSessionRepository } from '../../domain/ports';
import { UnitSkipTest } from '../../domain/services/unit-skip-test';
import { StartUnitSkipTestCommand } from './commands';

/**
 * 유닛 건너뛰기 테스트 시작. 잠긴 유닛도 응시할 수 있다(그게 목적).
 * 세션은 kind=placement, lesson_id=유닛의 마지막 레슨으로 저장하고, 같은 유닛의 미완료 테스트가 있으면 이어서 푼다.
 */
@CommandHandler(StartUnitSkipTestCommand)
export class StartUnitSkipTestHandler implements ICommandHandler<StartUnitSkipTestCommand, { sessionId: string; resumed: boolean }> {
  constructor(
    @Inject(LESSON_SESSION_REPO) private readonly sessions: LessonSessionRepository,
    @Inject(CURRICULUM_QUERY_PORT) private readonly curriculum: CurriculumQueryPort,
    private readonly uow: UnitOfWork,
    private readonly publisher: EventPublisher,
  ) {}

  async execute(cmd: StartUnitSkipTestCommand) {
    const userId = UserId.of(cmd.userId);
    const result = await this.uow.run(async () => {
      const unit = await this.curriculum.unitOutline(cmd.unitId);
      if (!unit || unit.lessonIds.length === 0) throw new UnitNotFound(cmd.unitId);
      const anchor = LessonId.of(unit.lessonIds[unit.lessonIds.length - 1]!);

      const open = await this.sessions.findOpen(userId, anchor, 'placement');
      if (open) return { session: open, resumed: true };

      const perLesson = await Promise.all(unit.lessonIds.map((id) => this.curriculum.publishedQuestionIds(LessonId.of(id))));
      const picked = UnitSkipTest.pickQuestions(perLesson);
      if (picked.length === 0) throw new LessonHasNoQuestions(anchor.value);

      const session = LessonSession.start({ userId, kind: 'placement', lessonId: anchor, questionIds: picked.map(QuestionId.of) });
      await this.sessions.save(session);
      return { session, resumed: false };
    });
    if (!result.resumed) this.publisher.mergeObjectContext(result.session).commit();
    return { sessionId: result.session.id.value, resumed: result.resumed };
  }
}
