import { describe, expect, it } from 'vitest';
import { applyMissedDay, extendStreak } from '../src/modules/progression/domain/streak';
import { addDaysToLocalDate, daysBetween, localDateOf, localTimeOf } from '../src/shared/domain/local-date';
import { zonedMidnightToUtc } from '../src/modules/learning/infrastructure/persistence/prisma-lesson-session.repository';

describe('extendStreak', () => {
  it('첫 달성: 1, 연속: +1, 같은 날 재달성: 변화 없음', () => {
    const a = extendStreak({ current: 0, longest: 0, lastActiveDate: null }, '2026-10-06');
    expect(a).toEqual({ next: { current: 1, longest: 1, lastActiveDate: '2026-10-06' }, extended: true });
    const b = extendStreak(a.next, '2026-10-07');
    expect(b.next.current).toBe(2);
    const c = extendStreak(b.next, '2026-10-07');
    expect(c.extended).toBe(false);
    expect(c.next.current).toBe(2);
  });

  it('하루 건너뛰면 1로 리셋, longest는 유지', () => {
    const r = extendStreak({ current: 9, longest: 9, lastActiveDate: '2026-10-04' }, '2026-10-06');
    expect(r.next).toEqual({ current: 1, longest: 9, lastActiveDate: '2026-10-06' });
  });
});

describe('applyMissedDay (배치)', () => {
  const base = { current: 5, longest: 5, lastActiveDate: '2026-10-04', freezeCount: 2 };
  it('어제를 놓쳤고 프리즈가 있으면 소모하고 lastActiveDate를 어제로', () => {
    const r = applyMissedDay(base, '2026-10-05');
    expect(r?.kind).toBe('freeze');
    expect(r?.next).toMatchObject({ current: 5, freezeCount: 1, lastActiveDate: '2026-10-05' });
  });
  it('프리즈가 없으면 리셋', () => {
    expect(applyMissedDay({ ...base, freezeCount: 0 }, '2026-10-05')?.kind).toBe('reset');
  });
  it('어제 활동했으면 아무것도 하지 않음', () => {
    expect(applyMissedDay({ ...base, lastActiveDate: '2026-10-05' }, '2026-10-05')).toBeNull();
  });
  it('스트릭이 0이면 건너뜀', () => {
    expect(applyMissedDay({ ...base, current: 0 }, '2026-10-05')).toBeNull();
  });
});

describe('local-date 유틸', () => {
  it('타임존 기준 날짜: UTC 15:30은 서울 다음날', () => {
    const t = new Date('2026-10-06T15:30:00Z');
    expect(localDateOf(t, 'Asia/Seoul')).toBe('2026-10-07');
    expect(localDateOf(t, 'UTC')).toBe('2026-10-06');
    expect(localTimeOf(t, 'Asia/Seoul')).toBe('00:30');
  });
  it('날짜 산술', () => {
    expect(addDaysToLocalDate('2026-10-31', 1)).toBe('2026-11-01');
    expect(daysBetween('2026-10-04', '2026-10-06')).toBe(2);
  });
  it('zonedMidnightToUtc: 서울 자정 = 전날 15:00 UTC', () => {
    expect(zonedMidnightToUtc('2026-10-07', 'Asia/Seoul').toISOString()).toBe('2026-10-06T15:00:00.000Z');
    expect(zonedMidnightToUtc('2026-10-07', 'UTC').toISOString()).toBe('2026-10-07T00:00:00.000Z');
  });
});
