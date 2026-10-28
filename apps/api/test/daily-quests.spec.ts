import { describe, expect, it } from 'vitest';
import {
  goalOf,
  pickDailyQuests,
  progressOf,
  titleOf,
  type DayActivity,
} from '../src/modules/quests/domain/daily-quests';

const october = Array.from({ length: 31 }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`);

describe('pickDailyQuests', () => {
  it('같은 사용자·날짜면 같은 3개', () => {
    const a = pickDailyQuests('u1', '2026-10-28', { reviewEligible: true });
    const b = pickDailyQuests('u1', '2026-10-28', { reviewEligible: true });
    expect(a).toEqual(b);
    expect(a).toHaveLength(3);
    expect(new Set(a).size).toBe(3);
  });

  it('날짜가 바뀌면 조합이 달라질 수 있다', () => {
    const combos = new Set(october.map((d) => pickDailyQuests('u1', d, { reviewEligible: true }).join(',')));
    expect(combos.size).toBeGreaterThanOrEqual(2);
  });

  it('reviewEligible=false면 review 없음', () => {
    for (const d of october) {
      const r = pickDailyQuests('u1', d, { reviewEligible: false });
      expect(r).toHaveLength(3);
      expect(r).not.toContain('review');
    }
  });
});

describe('goalOf / titleOf', () => {
  it('목표', () => {
    expect(goalOf('lessons', 1)).toBe(2);
    expect(goalOf('lessons', 3)).toBe(4);
    expect(goalOf('xp', 1)).toBe(30);
    expect(goalOf('perfect', 1)).toBe(1);
    expect(goalOf('review', 1)).toBe(1);
    expect(goalOf('accurate', 1)).toBe(2);
  });
  it('제목', () => {
    expect(titleOf('lessons', 2)).toBe('레슨 2개 완료하기');
    expect(titleOf('xp', 30)).toBe('XP 30 모으기');
    expect(titleOf('perfect', 1)).toBe('100점 레슨 1개');
    expect(titleOf('review', 1)).toBe('복습 1회 하기');
    expect(titleOf('accurate', 2)).toBe('정답률 90% 이상 레슨 2개');
  });
});

describe('progressOf', () => {
  const a: DayActivity = { lessons: 4, perfect: 2, accurate: 3, reviews: 1, xpExcludingQuest: 25 };
  it('키별로 대응 필드를 쓴다', () => {
    expect(progressOf('lessons', a)).toBe(4);
    expect(progressOf('xp', a)).toBe(25);
    expect(progressOf('perfect', a)).toBe(2);
    expect(progressOf('review', a)).toBe(1);
    expect(progressOf('accurate', a)).toBe(3);
  });
});
