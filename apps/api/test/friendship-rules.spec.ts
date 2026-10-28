import { describe, expect, it } from 'vitest';
import {
  decideSend,
  escapeLike,
  FRIEND_LIMIT,
  PENDING_OUT_LIMIT,
  pairKey,
  SEARCH_MAX,
  SEARCH_MIN,
} from '../src/modules/social/domain/friendship-rules';

const base = { blockedEitherWay: false, existing: null, me: 'me', myFriends: 0, myPendingOut: 0, theirFriends: 0 } as const;

describe('friendship-rules 상수', () => {
  it('값', () => {
    expect([FRIEND_LIMIT, PENDING_OUT_LIMIT, SEARCH_MIN, SEARCH_MAX]).toEqual([100, 20, 2, 10]);
  });
});

describe('pairKey', () => {
  it('작은 id가 low', () => {
    expect(pairKey('b', 'a')).toEqual({ low: 'a', high: 'b' });
    expect(pairKey('a', 'b')).toEqual({ low: 'a', high: 'b' });
  });
});

describe('decideSend', () => {
  it('아무 관계 없으면 create', () => {
    expect(decideSend({ ...base })).toBe('create');
  });
  it('차단 관계면 silent (다른 조건보다 우선)', () => {
    expect(decideSend({ ...base, blockedEitherWay: true, existing: { status: 'accepted', requesterId: 'x' }, myPendingOut: 20 })).toBe('silent');
  });
  it('상대가 보낸 대기 요청이면 accept-reverse (한도보다 우선)', () => {
    expect(decideSend({ ...base, existing: { status: 'pending', requesterId: 'x' }, myPendingOut: 20, myFriends: 100 })).toBe('accept-reverse');
  });
  it('내가 보낸 대기 요청이나 친구 관계면 already', () => {
    expect(decideSend({ ...base, existing: { status: 'pending', requesterId: 'me' } })).toBe('already');
    expect(decideSend({ ...base, existing: { status: 'accepted', requesterId: 'x' } })).toBe('already');
    expect(decideSend({ ...base, existing: { status: 'accepted', requesterId: 'me' }, myPendingOut: 20 })).toBe('already');
  });
  it('보낸 대기 20개면 limit, 19개면 create', () => {
    expect(decideSend({ ...base, myPendingOut: 20 })).toBe('limit');
    expect(decideSend({ ...base, myPendingOut: 19 })).toBe('create');
  });
  it('내 친구 100명이면 limit, 99명이면 create', () => {
    expect(decideSend({ ...base, myFriends: 100 })).toBe('limit');
    expect(decideSend({ ...base, myFriends: 99 })).toBe('create');
  });
  it('상대 친구가 100명이어도 응답이 달라지지 않는다(create)', () => {
    expect(decideSend({ ...base, theirFriends: 100 })).toBe('create');
  });
});

describe('escapeLike', () => {
  it('\\ % _ 이스케이프', () => {
    expect(escapeLike('a%_\\')).toBe('a\\%\\_\\\\');
    expect(escapeLike('abc')).toBe('abc');
  });
});
