import { describe, expect, it } from 'vitest';
import { CompleteSessionHandler } from '../src/modules/learning/application/commands/complete-session.handler';
import { CompleteSessionCommand } from '../src/modules/learning/application/commands/commands';
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

// ---- 평가·조회 핸들러 (포트를 가짜로 주입) ----
import { EvaluateQuestsCommand, GetMyQuestsQuery } from '../src/modules/quests/application/commands';
import { EvaluateQuestsHandler } from '../src/modules/quests/application/evaluate-quests.handler';
import { GetMyQuestsHandler } from '../src/modules/quests/application/get-my-quests.handler';
import { vi } from 'vitest';

const AT = new Date('2026-10-28T03:00:00Z'); // 서울 12:00 → 로컬 2026-10-28
const zero: DayActivity = { lessons: 0, perfect: 0, accurate: 0, reviews: 0, xpExcludingQuest: 0 };

/** 메모리 가짜 DAILY_PICK_REPO — 처음 계산한 값을 (user, period)에 고정한다. */
function fakePicks() {
  const store = new Map<string, string[]>();
  return {
    store,
    getOrCreate: vi.fn(async (userId: string, period: string, compute: () => Promise<string[]>) => {
      const k = `${userId}|${period}`;
      if (!store.has(k)) store.set(k, await compute());
      return store.get(k)!;
    }),
  };
}

/** 메모리 가짜 FRIEND_QUEST_REPO — 이번 주 퀘스트 하나와 사용자별 레슨 수 */
function fakeFriendRepo(quest: { goal: number; members: { userId: string; nickname: string; avatarUrl: string | null }[] } | null, counts: Record<string, number> = {}) {
  return {
    activeQuestOf: vi.fn(async () => quest),
    lessonCounts: vi.fn(async (ids: string[]) => new Map(ids.map((id) => [id, counts[id] ?? 0]))),
  };
}

function build(opts: { activity?: Partial<DayActivity>; due?: number; inserted?: boolean; dailyGoal?: number; friend?: ReturnType<typeof fakeFriendRepo> }) {
  const activity = { ...zero, ...opts.activity };
  const credit = vi.fn().mockResolvedValue(undefined);
  const tryInsert = vi.fn().mockResolvedValue(opts.inserted ?? true);
  const deps = {
    uow: { run: <T>(fn: () => Promise<T>) => fn() },
    prefs: { prefsOf: vi.fn().mockResolvedValue({ timeZone: 'Asia/Seoul', dailyGoal: opts.dailyGoal ?? 1, codeLanguage: 'python' }) },
    activity: { dayActivity: vi.fn().mockResolvedValue(activity), dailyGoalOf: vi.fn().mockResolvedValue(opts.dailyGoal ?? 1) },
    rewards: { tryInsert },
    picks: fakePicks(),
    ledger: { credit },
    queryBus: { execute: vi.fn().mockResolvedValue(opts.due ?? 0) },
    friend: opts.friend ?? fakeFriendRepo(null),
  };
  return { deps, credit, tryInsert };
}
const mk = (d: ReturnType<typeof build>['deps']) =>
  new EvaluateQuestsHandler(d.uow as never, d.prefs as never, d.activity as never, d.rewards as never, d.ledger as never, d.picks as never, d.queryBus as never, d.friend as never);

function userWithKey(key: string, date = '2026-10-28', eligible = true) {
  for (let i = 0; i < 500; i++) {
    const id = `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
    if (pickDailyQuests(id, date, { reviewEligible: eligible }).includes(key as never)) return id;
  }
  throw new Error('no user');
}

describe('EvaluateQuestsHandler', () => {
  it('목표 도달 퀘스트만 지급', async () => {
    const userId = userWithKey('lessons');
    const { deps, credit } = build({ activity: { lessons: 2 }, dailyGoal: 1 });
    // lessons만 목표(2) 도달. 다른 퀘스트는 0이라 미달
    const r = await mk(deps).execute(new EvaluateQuestsCommand(userId, AT));
    expect(r).toEqual([{ key: 'lessons', title: '레슨 2개 완료하기', xp: 10 }]);
    expect(credit).toHaveBeenCalledTimes(1);
    expect(credit.mock.calls[0]![0]).toMatchObject({ userId, amount: 10, reason: 'quest', at: AT });
  });

  it('이미 지급된 퀘스트는 다시 주지 않음', async () => {
    const userId = userWithKey('lessons');
    const { deps, credit } = build({ activity: { lessons: 2 }, inserted: false });
    const r = await mk(deps).execute(new EvaluateQuestsCommand(userId, AT));
    expect(r).toEqual([]);
    expect(credit).not.toHaveBeenCalled();
  });

  it('복습을 다 끝낸 날에도 review 유지', async () => {
    // reviewEligible 여부로 결과가 달라지는 사용자·날짜
    let userId = '';
    for (let i = 0; i < 500 && !userId; i++) {
      const id = `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
      const on = pickDailyQuests(id, '2026-10-28', { reviewEligible: true });
      const off = pickDailyQuests(id, '2026-10-28', { reviewEligible: false });
      if (on.join() !== off.join() && on.includes('review')) userId = id;
    }
    expect(userId).not.toBe('');
    const expected = pickDailyQuests(userId, '2026-10-28', { reviewEligible: true });
    const { deps, tryInsert } = build({ activity: { reviews: 1 }, due: 0 });
    await mk(deps).execute(new EvaluateQuestsCommand(userId, AT));
    // review 목표(1)를 채웠으므로 review가 뽑혔다면 지급 시도 키에 포함
    const keys = tryInsert.mock.calls.map((c) => c[0].questKey);
    expect(keys).toEqual(expected.filter((k) => k === 'review'));

    const none = build({ activity: { reviews: 0 }, due: 0 });
    await mk(none.deps).execute(new EvaluateQuestsCommand(userId, AT));
    expect(none.tryInsert).not.toHaveBeenCalled();
  });
});

describe('GetMyQuestsHandler', () => {
  it('progress는 goal로 제한, done은 progress>=goal, friend는 null', async () => {
    const userId = userWithKey('lessons');
    const { deps } = build({ activity: { lessons: 9, xpExcludingQuest: 5 }, dailyGoal: 1 });
    const h = new GetMyQuestsHandler(deps.prefs as never, deps.activity as never, deps.picks as never, deps.queryBus as never, deps.friend as never);
    const r = await h.execute(new GetMyQuestsQuery(userId, AT));
    expect(r.date).toBe('2026-10-28');
    expect(r.friend).toBeNull();
    expect(r.daily).toHaveLength(3);
    for (const q of r.daily) {
      expect(q.progress).toBeLessThanOrEqual(q.goal);
      expect(q.done).toBe(q.progress >= q.goal);
      expect(q.xp).toBe(10);
    }
    const lessons = r.daily.find((q) => q.key === 'lessons')!;
    expect(lessons).toMatchObject({ progress: 2, goal: 2, done: true });
  });
});

describe('그날 퀘스트 고정 (daily_quest_picks)', () => {
  function reviewUser() {
    for (let i = 0; i < 500; i++) {
      const id = `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
      const on = pickDailyQuests(id, '2026-10-28', { reviewEligible: true });
      const off = pickDailyQuests(id, '2026-10-28', { reviewEligible: false });
      if (on.join() !== off.join() && on.includes('review')) return { id, on, off };
    }
    throw new Error('no user');
  }

  it('첫 조회에서 저장한 3개는 due·복습 값이 바뀌어도 이후 조회·평가에서 그대로', async () => {
    const { id, on } = reviewUser();
    const { deps, tryInsert } = build({ due: 3 });
    const get = new GetMyQuestsHandler(deps.prefs as never, deps.activity as never, deps.picks as never, deps.queryBus as never, deps.friend as never);
    const first = await get.execute(new GetMyQuestsQuery(id, AT));
    expect(first.daily.map((q) => q.key)).toEqual(on);

    // 복습을 다 해서 due 0, 오늘 복습 0으로 보이는 상태
    deps.queryBus.execute.mockClear();
    deps.queryBus.execute.mockResolvedValue(0);
    deps.activity.dayActivity.mockResolvedValue({ ...zero, reviews: 0 });
    const second = await get.execute(new GetMyQuestsQuery(id, AT));
    expect(second.daily.map((q) => q.key)).toEqual(on);
    expect(deps.queryBus.execute).not.toHaveBeenCalled(); // pick이 있으면 due 조회 생략

    // 평가도 같은 3개를 본다: review 목표를 채우면 review가 지급 대상
    deps.activity.dayActivity.mockResolvedValue({ ...zero, reviews: 1 });
    await mk(deps).execute(new EvaluateQuestsCommand(id, AT));
    expect(tryInsert.mock.calls.map((c) => c[0].questKey)).toEqual(['review']);
  });

  it('다른 날짜는 따로 뽑는다', async () => {
    const { id } = reviewUser();
    const { deps } = build({ due: 1 });
    const get = new GetMyQuestsHandler(deps.prefs as never, deps.activity as never, deps.picks as never, deps.queryBus as never, deps.friend as never);
    await get.execute(new GetMyQuestsQuery(id, AT));
    await get.execute(new GetMyQuestsQuery(id, new Date('2026-10-29T03:00:00Z')));
    expect([...deps.picks.store.keys()]).toEqual([`${id}|2026-10-28`, `${id}|2026-10-29`]);
  });
});

describe('CompleteSessionHandler 퀘스트 평가', () => {
  const build = (evaluate: () => Promise<unknown>) => {
    const userIdValue = '11111111-1111-4111-8111-111111111111';
    const session = {
      userId: { equals: () => true },
      lessonId: null,
      kind: 'lesson',
      complete: () => ({ correct: 9, total: 10, xpEarned: 50 }),
    };
    const sessions = { findById: async () => session, save: async () => undefined, countCompletedToday: async () => 0 };
    const prefs = { prefsOf: async () => ({ timeZone: 'Asia/Seoul' }) };
    const uow = { run: <T>(fn: () => Promise<T>) => fn() };
    const publisher = { mergeObjectContext: (s: unknown) => ({ commit: () => undefined, ...(s as object) }) };
    const commandBus = {
      execute: vi.fn(async (cmd: unknown) => {
        if (cmd instanceof EvaluateQuestsCommand) return evaluate();
        return { skippedLessons: 0, streak: { current: 1, extended: true }, dailyGoal: { target: 1, done: 1, achieved: true } };
      }),
    };
    const queryBus = { execute: async () => 0 };
    const handler = new CompleteSessionHandler(sessions as never, prefs as never, {} as never, uow as never, publisher as never, commandBus as never, queryBus as never);
    return { handler, commandBus, userIdValue };
  };

  it('평가가 던져도 완료는 성공, questRewards는 []', async () => {
    const { handler, userIdValue } = build(async () => {
      throw new Error('db down');
    });
    const r = await handler.execute(new CompleteSessionCommand(userIdValue, '22222222-2222-4222-8222-222222222222'));
    expect(r.correct).toBe(9);
    expect(r.questRewards).toEqual([]);
  });

  it('평가 결과를 questRewards로 돌려준다', async () => {
    const reward = { key: 'lessons', title: '레슨 2개 완료하기', xp: 10 };
    const { handler, userIdValue } = build(async () => [reward]);
    const r = await handler.execute(new CompleteSessionCommand(userIdValue, '22222222-2222-4222-8222-222222222222'));
    expect(r.questRewards).toEqual([reward]);
  });
});

// ---- 프렌즈 퀘스트 ----
describe('EvaluateQuestsHandler 친구 퀘스트', () => {
  const A = '00000000-0000-4000-8000-00000000000a';
  const B = '00000000-0000-4000-8000-00000000000b';
  const quest = { goal: 15, members: [{ userId: B, nickname: 'bee', avatarUrl: null }, { userId: A, nickname: 'ay', avatarUrl: null }] };
  const rewardsOf = (tryInsert: ReturnType<typeof vi.fn>) => tryInsert.mock.calls.map((c) => c[0]).filter((r) => r.questKey === 'friend');

  it('합이 목표 미만이면 지급하지 않는다', async () => {
    const { deps, tryInsert } = build({ friend: fakeFriendRepo(quest, { [A]: 7, [B]: 7 }) });
    await mk(deps).execute(new EvaluateQuestsCommand(A, AT));
    expect(rewardsOf(tryInsert)).toEqual([]);
  });

  it('합이 15 이상이면 두 사람 모두 id 순으로 지급하고 응답에는 호출자 몫만 싣는다', async () => {
    const { deps, tryInsert, credit } = build({ friend: fakeFriendRepo(quest, { [A]: 8, [B]: 7 }) });
    const r = await mk(deps).execute(new EvaluateQuestsCommand(B, AT));
    // 2026-10-28 수요일 → 서울 주 시작 월요일 2026-10-26
    expect(rewardsOf(tryInsert)).toEqual([
      { userId: A, questKey: 'friend', period: '2026-10-26', xp: 50 },
      { userId: B, questKey: 'friend', period: '2026-10-26', xp: 50 },
    ]);
    expect(credit.mock.calls.filter((c) => c[0].amount === 50).map((c) => c[0].userId)).toEqual([A, B]);
    expect(r.filter((x) => x.key === 'friend')).toEqual([{ key: 'friend', title: '친구와 레슨 15개', xp: 50 }]);
  });

  it('이미 지급된 사람은 다시 적립하지 않고 응답에도 없다', async () => {
    const { deps, tryInsert, credit } = build({ friend: fakeFriendRepo(quest, { [A]: 9, [B]: 9 }) });
    tryInsert.mockImplementation(async (r: { userId: string }) => r.userId === A);
    const r = await mk(deps).execute(new EvaluateQuestsCommand(B, AT));
    expect(credit.mock.calls.filter((c) => c[0].amount === 50).map((c) => c[0].userId)).toEqual([A]);
    expect(r.some((x) => x.key === 'friend')).toBe(false);
  });

  it('짝이 없으면 아무 것도 하지 않는다', async () => {
    const { deps, tryInsert } = build({ friend: fakeFriendRepo(null) });
    await mk(deps).execute(new EvaluateQuestsCommand(A, AT));
    expect(rewardsOf(tryInsert)).toEqual([]);
  });
});

describe('GetMyQuestsHandler 친구 퀘스트', () => {
  const A = '00000000-0000-4000-8000-00000000000a';
  const B = '00000000-0000-4000-8000-00000000000b';
  const quest = { goal: 15, members: [{ userId: A, nickname: 'ay', avatarUrl: null }, { userId: B, nickname: 'bee', avatarUrl: 'https://x.test/b.png' }] };
  const get = (deps: ReturnType<typeof build>['deps']) =>
    new GetMyQuestsHandler(deps.prefs as never, deps.activity as never, deps.picks as never, deps.queryBus as never, deps.friend as never);

  it('짝·내 수·짝 수·목표·종료 시각을 돌려준다', async () => {
    const { deps } = build({ friend: fakeFriendRepo(quest, { [A]: 4, [B]: 6 }) });
    const r = await get(deps).execute(new GetMyQuestsQuery(A, AT));
    expect(r.friend).toEqual({ partner: { nickname: 'bee', avatarUrl: 'https://x.test/b.png' }, mine: 4, theirs: 6, goal: 15, done: false, endsAt: '2026-11-01T15:00:00.000Z' });
  });

  it('합이 목표 이상이면 done', async () => {
    const { deps } = build({ friend: fakeFriendRepo(quest, { [A]: 9, [B]: 9 }) });
    expect((await get(deps).execute(new GetMyQuestsQuery(A, AT))).friend?.done).toBe(true);
  });

  it('퀘스트가 없으면 null', async () => {
    const { deps } = build({});
    expect((await get(deps).execute(new GetMyQuestsQuery(A, AT))).friend).toBeNull();
  });
});
