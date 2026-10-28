import { describe, expect, it } from 'vitest';
import { seoulWeekStart } from '../src/modules/social/domain/week';

describe('seoulWeekStart', () => {
  it('수요일 → 그 주 월요일 00:00 서울(= 일요일 15:00 UTC)', () => {
    expect(seoulWeekStart(new Date('2026-10-28T03:00:00Z')).toISOString()).toBe('2026-10-25T15:00:00.000Z');
  });
  it('서울 일요일 23:59는 아직 그 주, 월요일 00:00부터 새 주', () => {
    expect(seoulWeekStart(new Date('2026-11-01T14:59:00Z')).toISOString()).toBe('2026-10-25T15:00:00.000Z');
    expect(seoulWeekStart(new Date('2026-11-01T15:00:00Z')).toISOString()).toBe('2026-11-01T15:00:00.000Z');
  });
  it('월요일 당일은 오늘 00:00', () => {
    expect(seoulWeekStart(new Date('2026-10-26T01:00:00Z')).toISOString()).toBe('2026-10-25T15:00:00.000Z');
  });
});
