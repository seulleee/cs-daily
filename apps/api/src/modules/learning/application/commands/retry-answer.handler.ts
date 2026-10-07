import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import type { RetryAnswerResponse } from '@cs-daily/contracts';
import { QuestionId, SessionId, UserId } from '../../../../shared/domain/ids';
import { SessionNotFound } from '../../domain/errors';
import { LESSON_SESSION_REPO, QUESTION_GRADING_PORT, type LessonSessionRepository, type QuestionGradingPort } from '../../domain/ports';
import { Grader } from '../../domain/services/grader';
import { RetryAnswerCommand } from './commands';

/**
 * 틀린 문제 다시 풀기 (듀오링고식 반복). 세션 상태를 바꾸지 않으므로 트랜잭션·저장·이벤트가 없다.
 * 허용 조건(미완료 세션, 첫 답이 오답인 문제)은 애그리거트가 검사한다.
 */
@CommandHandler(RetryAnswerCommand)
export class RetryAnswerHandler implements ICommandHandler<RetryAnswerCommand, RetryAnswerResponse> {
  constructor(
    @Inject(LESSON_SESSION_REPO) private readonly sessions: LessonSessionRepository,
    @Inject(QUESTION_GRADING_PORT) private readonly questions: QuestionGradingPort,
    private readonly grader: Grader,
  ) {}

  async execute(cmd: RetryAnswerCommand): Promise<RetryAnswerResponse> {
    const session = await this.sessions.findById(SessionId.of(cmd.sessionId));
    if (!session || !session.userId.equals(UserId.of(cmd.userId))) throw new SessionNotFound(cmd.sessionId);
    const q = await this.questions.forGrading(QuestionId.of(cmd.questionId));
    const isCorrect = session.retry(q, cmd.answer, this.grader);
    return { isCorrect, correctAnswer: q.answerKey, explanation: q.explanation };
  }
}
