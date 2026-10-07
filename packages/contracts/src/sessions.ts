import { z } from 'zod';
import { PublicQuestion, UserAnswer } from './questions.js';

/** placement = 유닛 건너뛰기 테스트 */
export const SessionKind = z.enum(['lesson', 'review', 'placement']);
export type SessionKind = z.infer<typeof SessionKind>;

/** POST /sessions/{id}/answers */
export const SubmitAnswerRequest = z.object({
  questionId: z.string().uuid(),
  answer: UserAnswer,
  timeMs: z.number().int().min(0).max(600_000),
});
export type SubmitAnswerRequest = z.infer<typeof SubmitAnswerRequest>;

export const SubmitAnswerResponse = z.object({
  isCorrect: z.boolean(),
  /** 채점 후에만 공개되는 정답 (해설 화면용) */
  correctAnswer: z.unknown(),
  explanation: z.string(),
  xpDelta: z.number().int(),
  answered: z.number().int(),
  total: z.number().int(),
});
export type SubmitAnswerResponse = z.infer<typeof SubmitAnswerResponse>;

export const AnsweredQuestion = z.object({
  questionId: z.string().uuid(),
  isCorrect: z.boolean(),
  correctAnswer: z.unknown(),
  explanation: z.string(),
});

/** POST /lessons/{lessonId}/sessions, POST /review/sessions, GET /sessions/{id} */
export const SessionResponse = z.object({
  id: z.string().uuid(),
  kind: SessionKind,
  lessonId: z.number().int().nullable(),
  lessonName: z.string().nullable(),
  questions: z.array(PublicQuestion),
  /** 이어 풀기용: 이미 답한 문제 */
  answered: z.array(AnsweredQuestion),
  finished: z.boolean(),
});
export type SessionResponse = z.infer<typeof SessionResponse>;

/** POST /sessions/{id}/complete */
export const CompleteSessionResponse = z.object({
  correct: z.number().int(),
  total: z.number().int(),
  xpEarned: z.number().int(),
  streak: z.object({
    current: z.number().int(),
    /** 이번 완료로 스트릭이 늘었는지 */
    extended: z.boolean(),
  }),
  dailyGoal: z.object({ target: z.number().int(), done: z.number().int(), achieved: z.boolean() }),
  newReviewCount: z.number().int(),
  /** 건너뛰기 테스트 결과 (kind=placement일 때만) */
  placement: z
    .object({
      passed: z.boolean(),
      passPercent: z.number().int(),
      unitName: z.string(),
      /** 통과로 새로 완료 처리된 레슨 수 */
      skippedLessons: z.number().int(),
    })
    .nullable(),
});
export type CompleteSessionResponse = z.infer<typeof CompleteSessionResponse>;
