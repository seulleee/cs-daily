import { addDaysToLocalDate } from '../../../shared/domain/local-date';

/** 리텐션을 재는 경과일. D1 = 가입 다음 날 재방문 */
export const RETENTION_DAYS = [1, 7, 30] as const;
export type RetentionDay = (typeof RETENTION_DAYS)[number];

/** 가입 코호트로 보는 최근 주 수 */
export const COHORT_WEEKS = 8;

/** "YYYY-MM-DD"가 속한 주의 월요일 */
export function weekStartOf(date: string): string {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0=일
  return addDaysToLocalDate(date, -((dow + 6) % 7));
}

/** today가 속한 주를 마지막으로 하는 최근 count개 주의 월요일 (오래된 순) */
export function recentCohortWeeks(today: string, count: number = COHORT_WEEKS): string[] {
  const last = weekStartOf(today);
  return Array.from({ length: count }, (_, i) => addDaysToLocalDate(last, -7 * (count - 1 - i)));
}

/**
 * D{n} 재방문이 "관측 가능"한지: 가입일 + n일이 지나간 날(로컬 오늘보다 이전)이어야 한다.
 * 아직 끝나지 않은 날은 분모에서 뺀다 — 안 그러면 최근 코호트의 리텐션이 실제보다 낮게 보인다.
 */
export function isRetentionMatured(signupDate: string, n: number, today: string): boolean {
  return addDaysToLocalDate(signupDate, n) < today;
}

/** 비율(0~1, 소수 4자리). 분모가 0이면 null */
export function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? Math.round((numerator / denominator) * 10_000) / 10_000 : null;
}

/** 가입 날짜별 집계 행(SQL 결과) */
export interface SignupDayRow {
  signup: string;
  users: number;
  eligible: Record<RetentionDay, number>;
  retained: Record<RetentionDay, number>;
}

export interface CohortRetention {
  weekStart: string;
  signups: number;
  /** D{n}: 관측 가능한 가입자 수(eligible), 재방문 수(retained), 비율(rate, 관측 가능자가 없으면 null) */
  d1: RetentionCell;
  d7: RetentionCell;
  d30: RetentionCell;
}
export interface RetentionCell {
  eligible: number;
  retained: number;
  rate: number | null;
}

/** 가입 날짜 행을 주 단위 코호트로 접는다. 대상 주 밖의 행은 버린다 */
export function foldCohorts(rows: SignupDayRow[], weeks: string[]): CohortRetention[] {
  const byWeek = new Map(weeks.map((w) => [w, { signups: 0, eligible: { 1: 0, 7: 0, 30: 0 }, retained: { 1: 0, 7: 0, 30: 0 } }]));
  for (const r of rows) {
    const acc = byWeek.get(weekStartOf(r.signup));
    if (!acc) continue;
    acc.signups += r.users;
    for (const n of RETENTION_DAYS) {
      acc.eligible[n] += r.eligible[n];
      acc.retained[n] += r.retained[n];
    }
  }
  return weeks.map((weekStart) => {
    const a = byWeek.get(weekStart)!;
    const cell = (n: RetentionDay): RetentionCell => ({ eligible: a.eligible[n], retained: a.retained[n], rate: ratio(a.retained[n], a.eligible[n]) });
    return { weekStart, signups: a.signups, d1: cell(1), d7: cell(7), d30: cell(30) };
  });
}
