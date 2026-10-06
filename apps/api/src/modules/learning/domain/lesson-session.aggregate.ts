import { AggregateRoot } from '../../../shared/domain/aggregate-root';
import { LessonId, QuestionId, SessionId, UserId } from '../../../shared/domain/ids';
import { Answer } from './answer.entity';
import { AnswerAlreadySubmitted, QuestionNotInSession, SessionAlreadyFinished, SessionIncomplete } from './errors';
import { AnswerGraded, SessionCompleted, SessionStarted } from './events';
import type { Grader } from './services/grader';
import type { QuestionForGrading } from './ports';
import type { SessionKind } from './services/session-kind';
import { XpPolicy } from './services/xp-policy';

export interface SessionSummary {
  correct: number;
  total: number;
  xpEarned: number;
}

/**
 * Learning 컨텍스트의 애그리거트 루트.
 * 불변식:
 *  - 완료된 세션에는 답을 제출할 수 없다
 *  - 세션에 고정된 questionIds에 있는 문제만, 문제당 한 번만 답할 수 있다
 *  - 모든 문제에 답한 뒤에만 완료할 수 있다
 */
export class LessonSession extends AggregateRoot {
  private constructor(
    readonly id: SessionId,
    readonly userId: UserId,
    readonly kind: SessionKind,
    readonly lessonId: LessonId | null,
    private readonly questionIds: readonly QuestionId[],
    /** 복습 큐에서 덧붙인 문제 (SM-2 품질 계산에 fromReview 표시) */
    private readonly reviewQuestionIds: ReadonlySet<string>,
    private readonly answers: Map<string, Answer>,
    private finishedAt: Date | null,
    private xpEarned: number,
    readonly startedAt: Date,
  ) {
    super();
  }

  static start(p: {
    userId: UserId;
    kind: SessionKind;
    lessonId: LessonId | null;
    questionIds: QuestionId[];
    reviewQuestionIds?: string[];
    now?: Date;
  }): LessonSession {
    if (p.questionIds.length === 0) throw new Error('LessonSession.start: 문제가 없습니다');
    const now = p.now ?? new Date();
    const s = new LessonSession(
      SessionId.new(),
      p.userId,
      p.kind,
      p.lessonId,
      [...p.questionIds],
      new Set(p.reviewQuestionIds ?? []),
      new Map(),
      null,
      0,
      now,
    );
    s.apply(new SessionStarted({ sessionId: s.id.value, userId: p.userId.value, kind: p.kind, lessonId: p.lessonId?.value ?? null }, now));
    return s;
  }

  /** 리포지토리 전용 복원 생성자 — 이벤트를 발행하지 않는다 */
  static rehydrate(p: {
    id: SessionId;
    userId: UserId;
    kind: SessionKind;
    lessonId: LessonId | null;
    questionIds: QuestionId[];
    reviewQuestionIds: string[];
    answers: Answer[];
    finishedAt: Date | null;
    xpEarned: number;
    startedAt: Date;
  }): LessonSession {
    return new LessonSession(
      p.id,
      p.userId,
      p.kind,
      p.lessonId,
      p.questionIds,
      new Set(p.reviewQuestionIds),
      new Map(p.answers.map((a) => [a.questionId.value, a])),
      p.finishedAt,
      p.xpEarned,
      p.startedAt,
    );
  }

  submitAnswer(q: QuestionForGrading, raw: unknown, timeMs: number, grader: Grader, now: Date = new Date()): Answer {
    if (this.finishedAt) throw new SessionAlreadyFinished(this.id.value);
    if (!this.questionIds.some((id) => id.equals(q.id))) throw new QuestionNotInSession(q.id.value);
    if (this.answers.has(q.id.value)) throw new AnswerAlreadySubmitted(q.id.value);

    const isCorrect = grader.grade(q.type, q.answerKey, raw);
    const answer = Answer.create({ questionId: q.id, questionVersion: q.version, raw, isCorrect, timeMs, answeredAt: now });
    this.answers.set(q.id.value, answer);
    this.apply(
      new AnswerGraded(
        {
          sessionId: this.id.value,
          userId: this.userId.value,
          questionId: q.id.value,
          kind: this.kind,
          isCorrect,
          timeMs,
          fromReview: this.kind === 'review' || this.reviewQuestionIds.has(q.id.value),
        },
        now,
      ),
    );
    return answer;
  }

  /** @param repeatsToday 오늘 같은 레슨을 이미 완료한 횟수 (XP 파밍 방지 정책 입력) */
  complete(repeatsToday: number, now: Date = new Date()): SessionSummary {
    if (this.finishedAt) throw new SessionAlreadyFinished(this.id.value);
    if (this.answers.size < this.questionIds.length) throw new SessionIncomplete(this.answers.size, this.questionIds.length);

    const total = this.questionIds.length;
    const correct = [...this.answers.values()].filter((a) => a.isCorrect).length;
    const xpEarned = XpPolicy.forSession({ correct, total, kind: this.kind, repeatsToday });
    this.finishedAt = now;
    this.xpEarned = xpEarned;
    this.apply(
      new SessionCompleted(
        { sessionId: this.id.value, userId: this.userId.value, kind: this.kind, lessonId: this.lessonId?.value ?? null, correct, total, xpEarned },
        now,
      ),
    );
    return { correct, total, xpEarned };
  }

  // ---- 조회용 (읽기 전용 스냅샷) ----
  get isFinished() {
    return this.finishedAt !== null;
  }
  get finished() {
    return this.finishedAt;
  }
  get earnedXp() {
    return this.xpEarned;
  }
  get orderedQuestionIds(): readonly QuestionId[] {
    return this.questionIds;
  }
  get reviewIds(): readonly string[] {
    return [...this.reviewQuestionIds];
  }
  get answeredCount() {
    return this.answers.size;
  }
  get correctCount() {
    return [...this.answers.values()].filter((a) => a.isCorrect).length;
  }
  answerFor(questionId: QuestionId): Answer | undefined {
    return this.answers.get(questionId.value);
  }
  allAnswers(): Answer[] {
    return [...this.answers.values()];
  }
}
