import { Inject } from '@nestjs/common';
import { CommandBus, CommandHandler, EventPublisher, ICommandHandler, QueryBus } from '@nestjs/cqrs';
import type { CompleteSessionResponse } from '@cs-daily/contracts';
import { SessionId, UserId } from '../../../../shared/domain/ids';
import { localDateOf } from '../../../../shared/domain/local-date';
import { UnitOfWork } from '../../../../shared/infrastructure/unit-of-work';
import { SessionNotFound } from '../../domain/errors';
import { CURRICULUM_QUERY_PORT, LESSON_SESSION_REPO, USER_PREFS_PORT, type CurriculumQueryPort, type LessonSessionRepository, type UserPrefsPort } from '../../domain/ports';
import { UnitSkipTest } from '../../domain/services/unit-skip-test';
import { RecordSessionCompletionCommand, type SessionCompletionResult } from '../../../progression/application/commands/commands';
import { CountDueReviewsQuery } from '../../../review/application/queries/queries';
import { CompleteSessionCommand } from './commands';

/**
 * 세션 완료.
 * Learning 트랜잭션(세션 완료 기록)을 커밋한 뒤, Progression의 커맨드를 동기 호출해
 * XP·스트릭·데일리 목표를 반영하고 그 결과를 응답에 담는다. (완료 화면이 즉시 스트릭을 보여줘야 하므로 이벤트가 아니라 커맨드)
 * AnswerGraded 이벤트는 Review(SM-2)가 비동기로 구독한다.
 */
@CommandHandler(CompleteSessionCommand)
export class CompleteSessionHandler implements ICommandHandler<CompleteSessionCommand, CompleteSessionResponse> {
  constructor(
    @Inject(LESSON_SESSION_REPO) private readonly sessions: LessonSessionRepository,
    @Inject(USER_PREFS_PORT) private readonly prefs: UserPrefsPort,
    @Inject(CURRICULUM_QUERY_PORT) private readonly curriculum: CurriculumQueryPort,
    private readonly uow: UnitOfWork,
    private readonly publisher: EventPublisher,
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  async execute(cmd: CompleteSessionCommand): Promise<CompleteSessionResponse> {
    const sessionId = SessionId.of(cmd.sessionId);
    const userId = UserId.of(cmd.userId);
    const now = new Date();
    const prefs = await this.prefs.prefsOf(userId);
    const localDate = localDateOf(now, prefs.timeZone);

    const { session, summary } = await this.uow.run(async () => {
      const session = await this.sessions.findById(sessionId);
      if (!session || !session.userId.equals(userId)) throw new SessionNotFound(cmd.sessionId);
      const repeats = session.lessonId ? await this.sessions.countCompletedToday(userId, session.lessonId, localDate, prefs.timeZone) : 0;
      const summary = session.complete(repeats, now);
      await this.sessions.save(session);
      return { session, summary };
    });
    this.publisher.mergeObjectContext(session).commit();

    // 건너뛰기 테스트: 통과하면 트랙 처음부터 이 유닛까지 완료 처리
    const unit = session.kind === 'placement' && session.lessonId ? await this.curriculum.unitOfLesson(session.lessonId) : null;
    const passed = unit ? UnitSkipTest.passed(summary.correct, summary.total) : false;

    const progression = await this.commandBus.execute<RecordSessionCompletionCommand, SessionCompletionResult>(
      new RecordSessionCompletionCommand({
        userId: cmd.userId,
        sessionId: cmd.sessionId,
        kind: session.kind,
        lessonId: session.lessonId?.value ?? null,
        skipLessonIds: passed && unit ? unit.lessonIdsThroughUnit : [],
        correct: summary.correct,
        total: summary.total,
        xpEarned: summary.xpEarned,
        localDate,
        occurredAt: now,
      }),
    );
    const newReviewCount = await this.queryBus.execute<CountDueReviewsQuery, number>(new CountDueReviewsQuery(cmd.userId, now));

    return {
      correct: summary.correct,
      total: summary.total,
      xpEarned: summary.xpEarned,
      streak: progression.streak,
      dailyGoal: progression.dailyGoal,
      newReviewCount,
      placement: unit ? { passed, passPercent: UnitSkipTest.PASS_PERCENT, unitName: unit.name, skippedLessons: progression.skippedLessons } : null,
    };
  }
}
