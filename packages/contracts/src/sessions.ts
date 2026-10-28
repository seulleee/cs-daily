import { z } from 'zod';
import { CodingLanguage, PublicQuestion, UserAnswer } from './questions.js';
import { QuestRewardItem } from './quests.js';

/** placement = 유닛 건너뛰기 테스트 */
export const SessionKind = z.enum(['lesson', 'review', 'placement']);
export type SessionKind = z.infer<typeof SessionKind>;

/** POST /sessions/{id}/answers */
export const SubmitAnswerRequest = z.object({
  questionId: z.string().uuid(),
  answer: UserAnswer,
  /** 언어별 variants 문제(PublicQuestion.lang이 있는 문제)는 받은 언어를 그대로 보낸다. 서버는 이 언어의 정답으로 채점한다 */
  lang: CodingLanguage.optional(),
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

/** POST /sessions/{id}/retry — 틀린 문제 다시 풀기. 채점만 하고 기록·XP·복습엔 영향 없음 */
export const RetryAnswerRequest = z.object({
  questionId: z.string().uuid(),
  answer: UserAnswer,
  lang: CodingLanguage.optional(),
});
export type RetryAnswerRequest = z.infer<typeof RetryAnswerRequest>;

export const RetryAnswerResponse = z.object({
  isCorrect: z.boolean(),
  correctAnswer: z.unknown(),
  explanation: z.string(),
});
export type RetryAnswerResponse = z.infer<typeof RetryAnswerResponse>;

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
  /** 레슨 시작 카드에 보여 줄 학습 목표 (lesson 종류일 때만) */
  lessonObjective: z.string().nullable(),
  /** 레슨 시작 카드의 핵심 정리 ("용어 — 정의"). lesson 종류가 아니면 빈 배열 */
  lessonKeyPoints: z.array(z.string()),
  /** 레슨 시작 카드의 도입 설명 문단. 없으면 빈 배열이거나 필드 자체가 없다(옛 API) */
  lessonIntro: z.array(z.string()).optional(),
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
  /** 이번 완료로 지급된 퀘스트 보상 (옛 API 호환을 위해 선택 필드) */
  questRewards: z.array(QuestRewardItem).optional(),
});
export type CompleteSessionResponse = z.infer<typeof CompleteSessionResponse>;
