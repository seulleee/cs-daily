import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { SessionResponse } from '@cs-daily/contracts';
import { QuestionId, SessionId, UserId } from '../../../../shared/domain/ids';
import { SessionNotFound } from '../../domain/errors';
import {
  CURRICULUM_QUERY_PORT,
  LESSON_SESSION_REPO,
  QUESTION_GRADING_PORT,
  type CurriculumQueryPort,
  type LessonSessionRepository,
  type QuestionGradingPort,
} from '../../domain/ports';

export class GetSessionQuery {
  constructor(
    readonly userId: string,
    readonly sessionId: string,
  ) {}
}

/**
 * 세션 화면 데이터. 문제 content는 정답 없이, 이미 답한 문제는 정답·해설을 포함해 돌려준다(이어 풀기).
 * 읽기 모델이지만 answer_key는 "이미 답한 문제"에 한해서만 채점 포트를 통해 노출한다.
 */
@QueryHandler(GetSessionQuery)
export class GetSessionHandler implements IQueryHandler<GetSessionQuery, SessionResponse> {
  constructor(
    @Inject(LESSON_SESSION_REPO) private readonly sessions: LessonSessionRepository,
    @Inject(CURRICULUM_QUERY_PORT) private readonly curriculum: CurriculumQueryPort,
    @Inject(QUESTION_GRADING_PORT) private readonly grading: QuestionGradingPort,
  ) {}

  async execute(q: GetSessionQuery): Promise<SessionResponse> {
    const session = await this.sessions.findById(SessionId.of(q.sessionId));
    if (!session || !session.userId.equals(UserId.of(q.userId))) throw new SessionNotFound(q.sessionId);

    const ids = session.orderedQuestionIds.map((id) => id.value);
    const publicQs = await this.curriculum.publicQuestions(ids);
    const byId = new Map(publicQs.map((p) => [p.id, p]));
    const questions = ids.map((id) => byId.get(id)).filter((p): p is NonNullable<typeof p> => !!p);

    const answered = await Promise.all(
      session.allAnswers().map(async (a) => {
        const g = await this.grading.forGrading(QuestionId.of(a.questionId.value));
        return { questionId: a.questionId.value, isCorrect: a.isCorrect, correctAnswer: g.answerKey, explanation: g.explanation };
      }),
    );

    // 건너뛰기 테스트는 레슨 대신 유닛 이름을 보여준다
    const title =
      session.kind === 'placement' && session.lessonId
        ? ((await this.curriculum.unitOfLesson(session.lessonId))?.name ?? null)
        : session.lessonId
          ? ((await this.curriculum.lessonOutline(session.lessonId))?.name ?? null)
          : null;
    return {
      id: session.id.value,
      kind: session.kind,
      lessonId: session.lessonId?.value ?? null,
      lessonName: title,
      questions,
      answered,
      finished: session.isFinished,
    };
  }
}
