import { describe, expect, it } from 'vitest';
import { ReviewPreview } from '../src/modules/learning/domain/services/review-preview';
import { nextReview } from '../src/modules/review/domain/sm2';
import { addDaysToLocalDate, localDateOf, zonedMidnightToUtc } from '../src/shared/domain/local-date';

const FRESH = { easeFactor: 2.5, intervalDays: 0, repetitions: 0 };

describe('ReviewPreview.cutoff — "내일 복습 예정" 집계 기준 시각', () => {
  it('사용자 로컬 "내일"의 마지막 순간(밀리초)이다', () => {
    // 서울 2026-10-08 → 내일은 10-09, 그날 23:59:59.999 KST = 14:59:59.999Z
    expect(ReviewPreview.cutoff('2026-10-08', 'Asia/Seoul').toISOString()).toBe('2026-10-09T14:59:59.999Z');
    expect(ReviewPreview.cutoff('2026-10-08', 'UTC').toISOString()).toBe('2026-10-09T23:59:59.999Z');
  });

  it('월말·연말 경계를 넘긴다', () => {
    expect(ReviewPreview.cutoff('2026-10-31', 'Asia/Seoul').toISOString()).toBe('2026-11-01T14:59:59.999Z');
    expect(ReviewPreview.cutoff('2026-12-31', 'Asia/Seoul').toISOString()).toBe('2027-01-01T14:59:59.999Z');
    expect(ReviewPreview.cutoff('2028-02-28', 'UTC').toISOString()).toBe('2028-02-29T23:59:59.999Z'); // 윤년
  });

  it('UTC 날짜와 로컬 날짜가 다른 시각(서울 새벽)은 로컬 날짜 기준으로 계산한다', () => {
    const now = new Date('2026-10-08T16:30:00Z'); // 서울 10-09 01:30
    const localDate = localDateOf(now, 'Asia/Seoul');
    expect(localDate).toBe('2026-10-09');
    expect(ReviewPreview.cutoff(localDate, 'Asia/Seoul').toISOString()).toBe('2026-10-10T14:59:59.999Z');
  });
});

describe('ReviewPreview.cutoff × SM-2 — 오늘 푼 문제의 복습은 항상 집계에 들어온다', () => {
  const localDate = '2026-10-08';
  const cutoff = ReviewPreview.cutoff(localDate, 'Asia/Seoul');
  // 오늘(서울) 00:00:00.000 ~ 23:59:59.999 사이의 대표 시각
  const answeredAts = ['2026-10-07T15:00:00.000Z', '2026-10-08T05:00:00.000Z', '2026-10-08T14:59:59.999Z'].map((s) => new Date(s));

  it.each(answeredAts.map((t) => [t.toISOString(), t] as const))('오답(%s)은 SM-2가 +1일로 예약하며 cutoff 이내', (_label, t) => {
    expect(nextReview(FRESH, 0, t).dueAt.getTime()).toBeLessThanOrEqual(cutoff.getTime());
  });

  it.each(answeredAts.map((t) => [t.toISOString(), t] as const))('처음 푼 정답(%s)도 1일 간격이라 cutoff 이내', (_label, t) => {
    expect(nextReview(FRESH, 5, t).dueAt.getTime()).toBeLessThanOrEqual(cutoff.getTime());
  });

  it('간격이 3일 이상인 복습은 내일 예정에 들어오지 않는다', () => {
    const second = nextReview({ easeFactor: 2.5, intervalDays: 1, repetitions: 1 }, 5, answeredAts[1]!);
    expect(second.intervalDays).toBe(3);
    expect(second.dueAt.getTime()).toBeGreaterThan(cutoff.getTime());
  });

  it('회귀 방지: "내일 00:00"을 기준으로 삼으면 방금 틀린 문제(내일 같은 시각)를 놓친다', () => {
    const startOfTomorrow = zonedMidnightToUtc(addDaysToLocalDate(localDate, 1), 'Asia/Seoul');
    const wrongAt = new Date('2026-10-08T05:00:00.000Z'); // 서울 14:00
    expect(nextReview(FRESH, 0, wrongAt).dueAt.getTime()).toBeGreaterThan(startOfTomorrow.getTime());
    expect(nextReview(FRESH, 0, wrongAt).dueAt.getTime()).toBeLessThanOrEqual(cutoff.getTime());
  });
});

describe('ReviewPreview.count — 비동기 복습 예약 하한', () => {
  it('DB 집계가 이번 세션 오답 수보다 작으면(아직 예약 전) 오답 수를 쓴다', () => {
    expect(ReviewPreview.count(0, 3)).toBe(3);
    expect(ReviewPreview.count(2, 3)).toBe(3);
  });
  it('DB 집계가 더 크면 DB 값을 그대로 쓴다 (이중 집계 없음)', () => {
    expect(ReviewPreview.count(7, 3)).toBe(7);
    expect(ReviewPreview.count(3, 3)).toBe(3);
  });
  it('오답이 없으면 DB 값 그대로', () => {
    expect(ReviewPreview.count(0, 0)).toBe(0);
    expect(ReviewPreview.count(4, 0)).toBe(4);
  });
});
