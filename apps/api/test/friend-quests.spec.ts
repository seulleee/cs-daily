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

import { PairFriendQuestsHandler } from '../src/modules/quests/application/pair-friend-quests.handler';
import { PairFriendQuestsCommand } from '../src/modules/quests/application/commands';
import type { FriendQuestRepository, FriendsPort } from '../src/modules/quests/domain/ports';

function fakes(activeIds: string[], friendships: [string, string][], lastPairs: [string, string][] = []) {
  const members = new Set<string>();
  const created: [string, string][] = [];
  const asked: string[][] = [];
  const repo: FriendQuestRepository = {
    activeUserIds: async () => activeIds,
    memberIdsOfWeek: async () => new Set(members),
    pairsOfWeek: async () => lastPairs,
    createPair: async (_w, a, b) => {
      if (members.has(a) || members.has(b)) return false;
      members.add(a);
      members.add(b);
      created.push([a, b]);
      return true;
    },
    endSharedQuest: async () => undefined,
  };
  const friends: FriendsPort = {
    friendIdsOf: async (ids) => {
      asked.push(ids);
      return new Map(ids.map((id) => [id, friendships.flatMap(([x, y]) => (x === id ? [y] : y === id ? [x] : []))]));
    },
    areFriends: async () => true,
  };
  return { handler: new PairFriendQuestsHandler(repo, friends), created, asked };
}

describe('PairFriendQuestsHandler', () => {
  const now = new Date('2026-11-01T15:30:00Z'); // 서울 월요일 00:30

  it('같은 now로 두 번 돌려도 짝 생성은 첫 실행분뿐', async () => {
    const { handler, created } = fakes(['a', 'b', 'c', 'd'], [['a', 'b'], ['c', 'd']]);
    const first = await handler.execute(new PairFriendQuestsCommand(now));
    expect(first).toEqual({ weekStart: '2026-11-02', pairs: 2 });
    const second = await handler.execute(new PairFriendQuestsCommand(now));
    expect(second.pairs).toBe(0);
    expect(created).toHaveLength(2);
  });

  it('최근 14일 활동이 없는 친구는 짝 대상에서 빠진다', async () => {
    const { handler, created, asked } = fakes(['a', 'b'], [['a', 'b'], ['a', 'z'], ['b', 'z']]);
    await handler.execute(new PairFriendQuestsCommand(now));
    expect(asked[0]).toEqual(['a', 'b']);
    expect(created).toEqual([['a', 'b']]);
  });

  it('활동 없는 친구만 있으면 짝이 없다', async () => {
    const { handler, created } = fakes(['a'], [['a', 'z']]);
    expect((await handler.execute(new PairFriendQuestsCommand(now))).pairs).toBe(0);
    expect(created).toHaveLength(0);
  });

  it('지난주 짝은 양방향으로 반영돼 다른 친구가 우선된다', async () => {
    // a가 먼저 고르는 삼각형. 지난주 짝이 [b, a] 순서로 저장돼 있어도 a는 b 대신 c를 고른다
    const { handler, created } = fakes(['a', 'b', 'c'], [['a', 'b'], ['a', 'c'], ['b', 'c']], [['b', 'a']]);
    await handler.execute(new PairFriendQuestsCommand(now));
    expect(created).toEqual([['a', 'c']]);
  });
});
