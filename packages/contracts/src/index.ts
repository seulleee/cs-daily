export * from './errors.js';
export * from './questions.js';
export * from './sessions.js';
export * from './curriculum.js';
export * from './me.js';

/** XP 정책 상수. 프런트의 미리보기 표시와 서버 계산이 같은 값을 쓴다. */
export const XP = {
  PER_CORRECT: 10,
  PERFECT_LESSON_BONUS: 20,
  REVIEW_MULTIPLIER: 1.5,
  /** 같은 레슨을 하루에 이 횟수 넘게 반복하면 XP 없음 */
  MAX_XP_REPEATS_PER_DAY: 3,
} as const;

export const STREAK = {
  FREEZES_PER_MONTH: 2,
} as const;
