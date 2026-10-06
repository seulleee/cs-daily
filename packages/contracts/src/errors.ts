/**
 * API 에러 코드. NestJS ExceptionFilter가 도메인 예외를 이 코드로 매핑하고,
 * 프런트는 같은 enum으로 분기한다. 새 도메인 예외를 추가하면 여기에도 추가한다.
 */
export const ErrorCode = {
  // 공통
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL: 'INTERNAL',

  // Learning
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  SESSION_FINISHED: 'SESSION_FINISHED',
  SESSION_INCOMPLETE: 'SESSION_INCOMPLETE',
  QUESTION_NOT_IN_SESSION: 'QUESTION_NOT_IN_SESSION',
  ANSWER_ALREADY_SUBMITTED: 'ANSWER_ALREADY_SUBMITTED',
  LESSON_LOCKED: 'LESSON_LOCKED',

  // Curriculum
  TRACK_NOT_FOUND: 'TRACK_NOT_FOUND',
  LESSON_NOT_FOUND: 'LESSON_NOT_FOUND',
  LESSON_HAS_NO_QUESTIONS: 'LESSON_HAS_NO_QUESTIONS',
  QUESTION_NOT_FOUND: 'QUESTION_NOT_FOUND',

  // Review
  NO_REVIEW_DUE: 'NO_REVIEW_DUE',

  // Identity
  NICKNAME_TAKEN: 'NICKNAME_TAKEN',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}
