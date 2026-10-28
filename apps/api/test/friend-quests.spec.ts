import { describe, expect, it } from 'vitest';
import { pairFriends, weekRangeUtc, weekStartSeoul } from '../src/modules/quests/domain/friend-quests';

describe('weekStartSeoul', () => {
  it('서울 일요일 23:59는 그 주 월요일', () => {
    expect(weekStartSeoul(new Date('2026-11-01T14:59:00Z'))).toBe('2026-10-26');
  });
  it('서울 월요일 00:00은 새 주', () => {
    expect(weekStartSeoul(new Date('2026-11-01T15:00:00Z'))).toBe('2026-11-02');
  });
  it('주 중간 날짜도 월요일을 돌려준다', () => {
    expect(weekStartSeoul(new Date('2026-10-28T03:00:00Z'))).toBe('2026-10-26');
  });
});

describe('weekRangeUtc', () => {
  it('서울 월요일 00:00 ~ 다음 월요일 00:00', () => {
    const r = weekRangeUtc('2026-11-02');
    expect(r.from.toISOString()).toBe('2026-11-01T15:00:00.000Z');
    expect(r.to.toISOString()).toBe('2026-11-08T15:00:00.000Z');
  });
});

describe('pairFriends', () => {
  const tri = [
    { id: 'a', friendIds: ['b', 'c'] },
    { id: 'b', friendIds: ['a', 'c'] },
    { id: 'c', friendIds: ['a', 'b'] },
  ];

  it('지난주 짝을 피해 다른 친구와 짝짓는다', () => {
    const pairs = pairFriends(tri, new Map([['a', 'b'], ['b', 'a']]));
    expect(pairs).toHaveLength(1);
    expect(pairs).not.toContainEqual(['a', 'b']);
  });

  it('둘뿐이면 지난주 짝과 다시 짝이 된다', () => {
    const users = [
      { id: 'a', friendIds: ['b'] },
      { id: 'b', friendIds: ['a'] },
    ];
    expect(pairFriends(users, new Map([['a', 'b'], ['b', 'a']]))).toEqual([['a', 'b']]);
  });

  it('홀수면 짝 1개와 한 명이 남는다', () => {
    const pairs = pairFriends(tri, new Map());
    expect(pairs).toHaveLength(1);
    expect(new Set(pairs.flat()).size).toBe(2);
  });

  it('사슬 a-b, b-c, c-d는 친구 적은 사람 우선으로 둘 다 짝', () => {
    const users = [
      { id: 'a', friendIds: ['b'] },
      { id: 'b', friendIds: ['a', 'c'] },
      { id: 'c', friendIds: ['b', 'd'] },
      { id: 'd', friendIds: ['c'] },
    ];
    expect(pairFriends(users, new Map())).toEqual([['a', 'b'], ['c', 'd']]);
  });

  it('users에 없는 친구와는 짝짓지 않는다', () => {
    expect(pairFriends([{ id: 'a', friendIds: ['zzz'] }], new Map())).toEqual([]);
  });

  it('같은 입력은 같은 결과', () => {
    const last = new Map([['a', 'b']]);
    expect(pairFriends(tri, last)).toEqual(pairFriends([...tri].reverse(), last));
  });
});
