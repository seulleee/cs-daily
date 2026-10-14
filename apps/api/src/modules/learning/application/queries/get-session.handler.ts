import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { SessionResponse } from '@cs-daily/contracts';
import { QuestionId, SessionId, UserId } from '../../../../shared/domain/ids';
import { SessionNotFound } from '../../domain/errors';
import {
  CURRICULUM_QUERY_PORT,
  LESSON_SESSION_REPO,
  QUESTION_GRADING_PORT,
  USER_PREFS_PORT,
  type CurriculumQueryPort,
  type LessonSessionRepository,
  type QuestionGradingPort,
  type UserPrefsPort,
} from '../../domain/ports';
import { languageOfRecordedAnswer, resolveGradingKey } from '../../domain/services/code-variants';

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
    @Inject(USER_PREFS_PORT) private readonly prefs: UserPrefsPort,
  ) {}

  async execute(q: GetSessionQuery): Promise<SessionResponse> {
    const session = await this.sessions.findById(SessionId.of(q.sessionId));
    if (!session || !session.userId.equals(UserId.of(q.userId))) throw new SessionNotFound(q.sessionId);

    const ids = session.orderedQuestionIds.map((id) => id.value);
    // 언어별 코드 문제는 사용자의 현재 설정 언어 variant로 펼친다 (다른 언어·정답은 내려가지 않는다)
    const { codeLanguage } = await this.prefs.prefsOf(session.userId);
    const publicQs = await this.curriculum.publicQuestions(ids, codeLanguage);
    const byId = new Map(publicQs.map((p) => [p.id, p]));
    // 이미 답한 문제는 답한 언어 그대로 보여 준다(세션 도중 설정을 바꿨어도 정답·해설과 코드가 어긋나지 않게)
    for (const lang of new Set(session.allAnswers().map((a) => languageOfRecordedAnswer(a.raw)))) {
      if (!lang || lang === codeLanguage) continue;
      const answeredIds = session.allAnswers().filter((a) => languageOfRecordedAnswer(a.raw) === lang).map((a) => a.questionId.value);
      for (const p of await this.curriculum.publicQuestions(answeredIds, lang)) byId.set(p.id, p);
    }
    const questions = ids.map((id) => byId.get(id)).filter((p): p is NonNullable<typeof p> => !!p);

    const answered = await Promise.all(
      session.allAnswers().map(async (a) => {
        const g = await this.grading.forGrading(QuestionId.of(a.questionId.value));
        // 답한 언어(답안 기록)의 정답·해설만 — 기록에 언어가 없으면 variants 문제가 아니다
        const key = resolveGradingKey(g.answerKey, g.explanation, languageOfRecordedAnswer(a.raw));
        return { questionId: a.questionId.value, isCorrect: a.isCorrect, correctAnswer: key.answerKey, explanation: key.explanation };
      }),
    );

    // 건너뛰기 테스트는 레슨 대신 유닛 이름을 보여준다. 학습 목표(시작 카드)는 lesson 종류에만
    let title: string | null = null;
    let objective: string | null = null;
    let keyPoints: string[] = [];
    if (session.kind === 'placement' && session.lessonId) {
      title = (await this.curriculum.unitOfLesson(session.lessonId))?.name ?? null;
    } else if (session.lessonId) {
      const outline = await this.curriculum.lessonOutline(session.lessonId);
      title = outline?.name ?? null;
      objective = outline?.objective ?? null;
      keyPoints = outline?.keyPoints ?? [];
    }
    return {
      id: session.id.value,
      kind: session.kind,
      lessonId: session.lessonId?.value ?? null,
      lessonName: title,
      lessonObjective: objective,
      lessonKeyPoints: keyPoints,
      questions,
      answered,
      finished: session.isFinished,
    };
  }
}
