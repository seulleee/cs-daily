import { Inject } from '@nestjs/common';
import { CommandHandler, EventPublisher, ICommandHandler } from '@nestjs/cqrs';
import type { SubmitAnswerResponse } from '@cs-daily/contracts';
import { QuestionId, SessionId, UserId } from '../../../../shared/domain/ids';
import { UnitOfWork } from '../../../../shared/infrastructure/unit-of-work';
import { SessionNotFound } from '../../domain/errors';
import { LESSON_SESSION_REPO, QUESTION_GRADING_PORT, type LessonSessionRepository, type QuestionGradingPort } from '../../domain/ports';
import { Grader } from '../../domain/services/grader';
import { XpPolicy } from '../../domain/services/xp-policy';
import { SubmitAnswerCommand } from './commands';

/**
 * 기획서 9절 "답안 제출 흐름":
 *  1. 세션 소유자·미완료·문제 포함 여부 확인 (애그리거트 불변식)
 *  2. 채점용 문제 조회 — Curriculum 포트(ACL)만 answer_key를 본다
 *  3. grade → answers INSERT (UNIQUE 충돌은 애그리거트가 먼저 막음)
 *  4~5. XP·복습 스케줄은 AnswerGraded 이벤트 핸들러가 각자 트랜잭션으로 처리
 *  6. 커밋 후 이벤트 발행
 */
@CommandHandler(SubmitAnswerCommand)
export class SubmitAnswerHandler implements ICommandHandler<SubmitAnswerCommand, SubmitAnswerResponse> {
  constructor(
    @Inject(LESSON_SESSION_REPO) private readonly sessions: LessonSessionRepository,
    @Inject(QUESTION_GRADING_PORT) private readonly questions: QuestionGradingPort,
    private readonly grader: Grader,
    private readonly uow: UnitOfWork,
    private readonly publisher: EventPublisher,
  ) {}

  async execute(cmd: SubmitAnswerCommand): Promise<SubmitAnswerResponse> {
    const sessionId = SessionId.of(cmd.sessionId);
    const userId = UserId.of(cmd.userId);

    const result = await this.uow.run(async () => {
      const session = await this.sessions.findById(sessionId);
      if (!session || !session.userId.equals(userId)) throw new SessionNotFound(cmd.sessionId);
      const q = await this.questions.forGrading(QuestionId.of(cmd.questionId));
      const answer = session.submitAnswer(q, cmd.answer, cmd.timeMs, this.grader);
      await this.sessions.save(session);
      return { session, q, answer };
    });

    this.publisher.mergeObjectContext(result.session).commit();

    return {
      isCorrect: result.answer.isCorrect,
      correctAnswer: result.q.answerKey,
      explanation: result.q.explanation,
      xpDelta: result.answer.isCorrect ? XpPolicy.perCorrectAnswer(result.session.kind) : 0,
      answered: result.session.answeredCount,
      total: result.session.orderedQuestionIds.length,
    };
  }
}
