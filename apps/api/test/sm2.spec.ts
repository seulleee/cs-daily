import { describe, expect, it } from 'vitest';
import { isMastered, nextReview, qualityOf } from '../src/modules/review/domain/sm2';

const now = new Date('2026-10-06T00:00:00Z');
const day = 86_400_000;

describe('SM-2', () => {
  it('첫 정답: 1일 뒤, 두 번째 정답: 3일 뒤, 이후 간격×ease', () => {
    let s = nextReview({ easeFactor: 2.5, intervalDays: 0, repetitions: 0 }, 5, now);
    expect(s.intervalDays).toBe(1);
    expect(s.dueAt.getTime()).toBe(now.getTime() + day);
    s = nextReview(s, 5, now);
    expect(s.intervalDays).toBe(3);
    expect(s.easeFactor).toBe(2.7); // 2.5 → 2.6 → 2.7
    s = nextReview(s, 5, now);
    expect(s.intervalDays).toBe(8); // round(3 × 2.7)
    expect(s.easeFactor).toBe(2.8);
    expect(s.repetitions).toBe(3);
  });

  it('오답: repetitions 0, 내일 다시, ease는 1.3 아래로 내려가지 않음', () => {
    let s = { easeFactor: 1.35, intervalDays: 10, repetitions: 4 };
    const r = nextReview(s, 0, now);
    expect(r).toMatchObject({ intervalDays: 1, repetitions: 0 });
    // 느린 정답(q=3)을 반복하면 ease가 내려가되 1.3에서 멈춘다
    s = r;
    for (let i = 0; i < 10; i += 1) s = nextReview(s, 3, now);
    expect(s.easeFactor).toBeGreaterThanOrEqual(1.3);
  });

  it('qualityOf: 정답+빠름 5, 정답+느림 3, 오답 0', () => {
    expect(qualityOf(true, 3_000, 8_000)).toBe(5);
    expect(qualityOf(true, 9_000, 8_000)).toBe(3);
    expect(qualityOf(false, 100, 8_000)).toBe(0);
  });

  it('isMastered: 5회 이상 반복 + 30일 이상 간격', () => {
    expect(isMastered({ easeFactor: 2.5, intervalDays: 31, repetitions: 5 })).toBe(true);
    expect(isMastered({ easeFactor: 2.5, intervalDays: 10, repetitions: 5 })).toBe(false);
  });
});
