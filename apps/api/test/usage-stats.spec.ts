import { describe, expect, it } from 'vitest';
import { foldCohorts, isRetentionMatured, ratio, recentCohortWeeks, weekStartOf, type SignupDayRow } from '../src/modules/jobs/domain/usage-stats';

describe('weekStartOf', () => {
  it('월요일 시작: 일요일은 직전 월요일, 월요일은 자기 자신', () => {
    expect(weekStartOf('2026-10-23')).toBe('2026-10-19'); // 금
    expect(weekStartOf('2026-10-19')).toBe('2026-10-19'); // 월
    expect(weekStartOf('2026-10-25')).toBe('2026-10-19'); // 일
    expect(weekStartOf('2026-10-26')).toBe('2026-10-26'); // 다음 월
  });
  it('연·월 경계를 넘는다', () => {
    expect(weekStartOf('2027-01-01')).toBe('2026-12-28');
  });
});

describe('recentCohortWeeks', () => {
  it('오늘이 속한 주를 마지막으로 8주를 오래된 순으로', () => {
    const w = recentCohortWeeks('2026-10-23', 8);
    expect(w).toHaveLength(8);
    expect(w[7]).toBe('2026-10-19');
    expect(w[0]).toBe('2026-08-31');
  });
});

describe('isRetentionMatured', () => {
  it('D+n일이 로컬 오늘보다 이전일 때만 관측 가능', () => {
    expect(isRetentionMatured('2026-10-21', 1, '2026-10-23')).toBe(true);
    expect(isRetentionMatured('2026-10-22', 1, '2026-10-23')).toBe(false); // D1 날짜가 오늘 — 아직 안 끝남
    expect(isRetentionMatured('2026-10-23', 1, '2026-10-23')).toBe(false);
    expect(isRetentionMatured('2026-10-01', 30, '2026-10-23')).toBe(false);
    expect(isRetentionMatured('2026-09-20', 30, '2026-10-23')).toBe(true);
  });
});

describe('ratio', () => {
  it('분모 0이면 null, 아니면 소수 4자리', () => {
    expect(ratio(0, 0)).toBeNull();
    expect(ratio(1, 3)).toBe(0.3333);
    expect(ratio(2, 2)).toBe(1);
  });
});

describe('foldCohorts', () => {
  it('가입 날짜 행을 주 단위로 합치고 범위 밖은 버린다', () => {
    const weeks = recentCohortWeeks('2026-10-23', 2); // 10-12, 10-19
    const rows: SignupDayRow[] = [
      { signup: '2026-10-12', users: 2, eligible: { 1: 2, 7: 2, 30: 0 }, retained: { 1: 1, 7: 0, 30: 0 } },
      { signup: '2026-10-18', users: 1, eligible: { 1: 1, 7: 0, 30: 0 }, retained: { 1: 1, 7: 0, 30: 0 } },
      { signup: '2026-10-20', users: 3, eligible: { 1: 3, 7: 0, 30: 0 }, retained: { 1: 0, 7: 0, 30: 0 } },
      { signup: '2026-10-05', users: 9, eligible: { 1: 9, 7: 9, 30: 9 }, retained: { 1: 9, 7: 9, 30: 9 } }, // 범위 밖
    ];
    const out = foldCohorts(rows, weeks);
    expect(out.map((c) => [c.weekStart, c.signups])).toEqual([['2026-10-12', 3], ['2026-10-19', 3]]);
    expect(out[0]!.d1).toEqual({ eligible: 3, retained: 2, rate: 0.6667 });
    expect(out[0]!.d7).toEqual({ eligible: 2, retained: 0, rate: 0 });
    expect(out[0]!.d30).toEqual({ eligible: 0, retained: 0, rate: null });
    expect(out[1]!.d1.rate).toBe(0);
    expect(out[1]!.d7.rate).toBeNull();
  });
  it('가입자가 없는 주도 0으로 나온다', () => {
    const out = foldCohorts([], recentCohortWeeks('2026-10-23', 2));
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ signups: 0, d1: { eligible: 0, retained: 0, rate: null } });
  });
});
