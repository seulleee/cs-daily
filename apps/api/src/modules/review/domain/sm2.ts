/**
 * 간격 반복 — SM-2 변형 (기획서 8.4). 순수 함수.
 * 품질 q: 0(오답) / 3(정답-느림) / 5(정답-빠름)
 */
export interface ReviewState {
  easeFactor: number; // 1.3 ~
  intervalDays: number;
  repetitions: number;
}

export type Quality = 0 | 3 | 5;

export const MASTERED_INTERVAL_DAYS = 30;
export const MASTERED_REPETITIONS = 5;

export function nextReview(state: ReviewState, q: Quality, now: Date): ReviewState & { dueAt: Date } {
  let { easeFactor: ef, intervalDays: i, repetitions: n } = state;
  if (q < 3) {
    n = 0;
    i = 1; // 오답: 내일 다시
  } else {
    i = n === 0 ? 1 : n === 1 ? 3 : Math.round(i * ef);
    n += 1;
    ef = Math.max(1.3, ef + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  }
  return { easeFactor: round2(ef), intervalDays: i, repetitions: n, dueAt: addDays(now, i) };
}

/** 응답 시간으로 품질 결정. 유형별 "빠름" 기준(ms)은 운영 데이터로 조정 */
export function qualityOf(isCorrect: boolean, timeMs: number, fastThresholdMs: number): Quality {
  if (!isCorrect) return 0;
  return timeMs <= fastThresholdMs ? 5 : 3;
}

export const FAST_THRESHOLD_MS: Record<string, number> = {
  single: 12_000,
  multi: 20_000,
  ox: 8_000,
  fill: 15_000,
};

export function isMastered(s: ReviewState): boolean {
  return s.repetitions >= MASTERED_REPETITIONS && s.intervalDays >= MASTERED_INTERVAL_DAYS;
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000);
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
