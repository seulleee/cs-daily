import { describe, expect, it } from 'vitest';
import { LessonId, QuestionId, UserId } from '../src/shared/domain/ids';
import { LessonSession } from '../src/modules/learning/domain/lesson-session.aggregate';
import { Grader } from '../src/modules/learning/domain/services/grader';
import { AnswerAlreadySubmitted, QuestionNotInSession, RetryNotAllowed, SessionAlreadyFinished, SessionIncomplete } from '../src/modules/learning/domain/errors';
import { AnswerGraded, SessionCompleted, SessionStarted } from '../src/modules/learning/domain/events';
import type { QuestionForGrading } from '../src/modules/learning/domain/ports';

const grader = new Grader();
const user = UserId.of('11111111-1111-1111-1111-111111111111');
const q = (n: number): QuestionForGrading => ({
  id: QuestionId.of(`00000000-0000-0000-0000-00000000000${n}`),
  type: 'ox',
  version: 1,
  answerKey: { value: true },
  explanation: 'e',
});

function newSession(count = 3, reviewTail: string[] = []) {
  const ids = Array.from({ length: count }, (_, i) => q(i + 1).id);
  return LessonSession.start({ userId: user, kind: 'lesson', lessonId: LessonId.of(7), questionIds: ids, reviewQuestionIds: reviewTail });
}

describe('LessonSession', () => {
  it('start: SessionStarted 이벤트를 쌓고 문제 순서를 고정한다', () => {
    const s = newSession();
    expect(s.pullDomainEvents()[0]).toBeInstanceOf(SessionStarted);
    expect(s.orderedQuestionIds.map((i) => i.value)).toEqual([q(1).id.value, q(2).id.value, q(3).id.value]);
    expect(() => LessonSession.start({ userId: user, kind: 'lesson', lessonId: LessonId.of(1), questionIds: [] })).toThrow();
  });

  it('submitAnswer: 채점 결과와 AnswerGraded 이벤트', () => {
    const s = newSession();
    s.pullDomainEvents();
    const a = s.submitAnswer(q(1), { value: true }, 1200, grader);
    expect(a.isCorrect).toBe(true);
    const ev = s.pullDomainEvents()[0] as AnswerGraded;
    expect(ev).toBeInstanceOf(AnswerGraded);
    expect(ev.payload).toMatchObject({ questionId: q(1).id.value, isCorrect: true, fromReview: false, kind: 'lesson' });
  });

  it('복습 꼬리 문제는 fromReview=true', () => {
    const s = newSession(3, [q(3).id.value]);
    s.submitAnswer(q(3), { value: false }, 500, grader);
    const ev = s.pullDomainEvents().find((e) => e instanceof AnswerGraded) as AnswerGraded;
    expect(ev.payload.fromReview).toBe(true);
    expect(ev.payload.isCorrect).toBe(false);
  });

  it('세션 밖 문제·중복 제출을 거부한다', () => {
    const s = newSession(2);
    expect(() => s.submitAnswer(q(9), { value: true }, 1, grader)).toThrow(QuestionNotInSession);
    s.submitAnswer(q(1), { value: true }, 1, grader);
    expect(() => s.submitAnswer(q(1), { value: true }, 1, grader)).toThrow(AnswerAlreadySubmitted);
  });

  it('모든 문제에 답하기 전에는 완료할 수 없다', () => {
    const s = newSession(2);
    s.submitAnswer(q(1), { value: true }, 1, grader);
    expect(() => s.complete(0)).toThrow(SessionIncomplete);
  });

  it('complete: 무결점 레슨 = 10×n + 20, SessionCompleted 이벤트, 이후 제출 불가', () => {
    const s = newSession(3);
    [1, 2, 3].forEach((n) => s.submitAnswer(q(n), { value: true }, 1, grader));
    s.pullDomainEvents();
    const summary = s.complete(0);
    expect(summary).toEqual({ correct: 3, total: 3, xpEarned: 50 });
    expect(s.pullDomainEvents()[0]).toBeInstanceOf(SessionCompleted);
    expect(s.isFinished).toBe(true);
    expect(() => s.submitAnswer(q(1), { value: true }, 1, grader)).toThrow(SessionAlreadyFinished);
    expect(() => s.complete(0)).toThrow(SessionAlreadyFinished);
  });

  it('complete: 오답이 있으면 보너스 없음, 하루 3회 초과 반복은 XP 0', () => {
    const s = newSession(2);
    s.submitAnswer(q(1), { value: true }, 1, grader);
    s.submitAnswer(q(2), { value: false }, 1, grader);
    expect(s.complete(0).xpEarned).toBe(10);

    const farmed = newSession(2);
    farmed.submitAnswer(q(1), { value: true }, 1, grader);
    farmed.submitAnswer(q(2), { value: true }, 1, grader);
    expect(farmed.complete(3).xpEarned).toBe(0);
  });

  it('review 세션은 XP ×1.5', () => {
    const s = LessonSession.start({ userId: user, kind: 'review', lessonId: null, questionIds: [q(1).id, q(2).id], reviewQuestionIds: [q(1).id.value, q(2).id.value] });
    s.submitAnswer(q(1), { value: true }, 1, grader);
    s.submitAnswer(q(2), { value: true }, 1, grader);
    expect(s.complete(0).xpEarned).toBe(60); // (20 + 20 bonus) × 1.5
  });

  it('rehydrate는 이벤트를 발행하지 않고 상태를 복원한다', () => {
    const s = newSession(2);
    s.submitAnswer(q(1), { value: true }, 1, grader);
    const r = LessonSession.rehydrate({
      id: s.id,
      userId: user,
      kind: 'lesson',
      lessonId: LessonId.of(7),
      questionIds: [...s.orderedQuestionIds],
      reviewQuestionIds: [],
      answers: s.allAnswers(),
      finishedAt: null,
      xpEarned: 0,
      startedAt: s.startedAt,
    });
    expect(r.pullDomainEvents()).toHaveLength(0);
    expect(r.answeredCount).toBe(1);
    expect(() => r.submitAnswer(q(1), { value: true }, 1, grader)).toThrow(AnswerAlreadySubmitted);
  });
});

describe('LessonSession.retry (틀린 문제 다시 풀기)', () => {
  it('첫 답이 오답인 문제만 재도전할 수 있고, 재도전은 기록·이벤트를 남기지 않는다', () => {
    const s = newSession(2);
    s.submitAnswer(q(1), { value: false }, 1000, grader); // 오답
    s.submitAnswer(q(2), { value: true }, 1000, grader); // 정답
    s.pullDomainEvents();

    expect(s.canRetry(q(1).id)).toBe(true);
    expect(s.canRetry(q(2).id)).toBe(false); // 맞힌 문제는 재도전 대상이 아님
    expect(s.canRetry(q(9).id)).toBe(false); // 세션 밖 문제

    expect(s.retry(q(1), { value: true }, grader)).toBe(true);
    expect(s.retry(q(1), { value: false }, grader)).toBe(false);
    expect(s.answeredCount).toBe(2); // 답안 수 그대로
    expect(s.correctCount).toBe(1); // 첫 답만 점수에 반영
    expect(s.pullDomainEvents()).toHaveLength(0);
  });

  it('아직 답하지 않았거나 맞힌 문제의 재도전은 거부한다', () => {
    const s = newSession(2);
    expect(() => s.retry(q(1), { value: true }, grader)).toThrow(RetryNotAllowed);
    s.submitAnswer(q(1), { value: true }, 1000, grader);
    expect(() => s.retry(q(1), { value: true }, grader)).toThrow(RetryNotAllowed);
  });

  it('완료된 세션에서는 재도전할 수 없다', () => {
    const s = newSession(1);
    s.submitAnswer(q(1), { value: false }, 1000, grader);
    s.complete(0);
    expect(() => s.retry(q(1), { value: true }, grader)).toThrow(SessionAlreadyFinished);
  });
});
