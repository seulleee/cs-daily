/**
 * E2E: 프렌즈 퀘스트 지급·조회 (CI 전용 — 실제 Postgres + 빌드된 서버에 HTTP로 요청)
 *  1. A-B 친구 수락 → A의 GET /me/quests friend.partner.nickname이 B 닉네임, A가 친구를 끊으면 friend === null
 *  2. A-B 짝(7+7) → A가 레슨 1개 완료 → questRewards에 friend 1개, 두 사람 quest_rewards·xp_events(50) 각 1행
 *  3. B가 이어서 완료 → B 응답에 friend 없음, 행 수 그대로
 *  4. C-D 짝(7+7)에서 둘이 동시에 완료 → 둘 다 200, quest_rewards(friend)는 각 1행
 *
 * 세션은 직접 INSERT한다(finished_at은 서울 이번 주 [월요일 00:00, 지금) 안).
 */
import { PrismaClient } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { MeQuestsResponse, QuestRewardItem } from '@cs-daily/contracts';
import { weekRangeUtc, weekStartSeoul } from '../src/modules/quests/domain/friend-quests';

const API = process.env.E2E_API_URL ?? 'http://localhost:4000';
const prisma = new PrismaClient();
const jwt = new JwtService({ secret: process.env.JWT_ACCESS_SECRET });

type Session = { id: string; questions: { id: string }[] };
type Completed = { questRewards?: QuestRewardItem[] };

const asUser = (id: string) => {
  const token = jwt.sign({ sub: id, role: 'user' }, { expiresIn: '10m' });
  return async <T>(method: string, path: string, body?: unknown): Promise<T> => {
    const res = await fetch(`${API}${path}`, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await res.text();
    assert.ok(res.status >= 200 && res.status < 300, `${method} ${path} → ${res.status} ${text}`);
    return (text ? JSON.parse(text) : undefined) as T;
  };
};
type Caller = ReturnType<typeof asUser>;

async function eventually<T>(fn: () => Promise<T | null | undefined | false>, what: string): Promise<T> {
  for (let i = 0; i < 40; i++) {
    const v = await fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`시간 안에 ${what} 되지 않음`);
}

async function main() {
  const stamp = Date.now();
  const ids: string[] = [];
  try {
    const track = await prisma.track.findUniqueOrThrow({ where: { slug: 'dsa' }, include: { units: { where: { sortOrder: { gt: 0 } }, orderBy: { sortOrder: 'asc' }, take: 1, include: { lessons: { where: { sortOrder: { gt: 0 } }, orderBy: { sortOrder: 'asc' }, take: 1 } } } } });
    const lesson = track.units[0]?.lessons[0];
    assert.ok(lesson, 'dsa 첫 레슨');

    const answerFor = async (questionId: string) => {
      const q = await prisma.question.findUniqueOrThrow({ where: { id: questionId }, select: { type: true, answerKey: true } });
      const key = q.answerKey as Record<string, unknown>;
      switch (q.type) {
        case 'single':
          return { index: key.index as number };
        case 'multi':
          return { indices: key.indices as number[] };
        case 'ox':
          return { value: key.value as boolean };
        default:
          return { text: (key.accepted as string[])[0]! };
      }
    };
    const completeLesson = async (call: Caller): Promise<Completed> => {
      const s = await call<Session>('POST', `/lessons/${lesson.id}/sessions`);
      for (const q of s.questions) await call('POST', `/sessions/${s.id}/answers`, { questionId: q.id, answer: await answerFor(q.id), timeMs: 1000 });
      return call<Completed>('POST', `/sessions/${s.id}/complete`);
    };
    const friendRewards = (c: Completed) => (c.questRewards ?? []).filter((r) => r.key === 'friend');

    // 서울 이번 주 [월요일 00:00, 지금) 안의 시각. 월요일 새벽에 돌려도 구간 안에 들어가도록 비율로 흩뿌린다.
    const now = new Date();
    const week = weekStartSeoul(now);
    const { from } = weekRangeUtc(week);
    const span = now.getTime() - from.getTime();
    assert.ok(span > 0);
    const seedLessons = async (userId: string, n: number) => {
      for (let i = 0; i < n; i++) {
        const t = new Date(from.getTime() + Math.floor((span * (i + 1)) / (n + 2)));
        await prisma.lessonSession.create({ data: { userId, lessonId: lesson.id, kind: 'lesson', questionIds: [], startedAt: t, finishedAt: t } });
      }
    };
    const mk = async (suffix: string) => {
      const id = randomUUID();
      ids.push(id);
      const nick = `efq${stamp % 1e7}${suffix}`;
      await prisma.user.create({ data: { id, email: `e2e-fq-${stamp}-${suffix}@example.test`, nickname: nick } });
      return { id, nick, call: asUser(id) };
    };
    type U = Awaited<ReturnType<typeof mk>>;
    const befriend = async (x: U, y: U) => {
      await x.call('POST', '/friends/requests', { userId: y.id });
      const incoming = (await y.call<{ incoming: { id: string }[] }>('GET', '/friends')).incoming;
      await y.call('POST', `/friends/requests/${incoming[0]!.id}/accept`);
    };
    const friendOf = async (u: U) => (await u.call<MeQuestsResponse>('GET', '/me/quests')).friend;
    const rewardRows = (userId: string) => prisma.questReward.count({ where: { userId, questKey: 'friend' } });
    const rewardXp = (userId: string) => prisma.xpEvent.count({ where: { userId, reason: 'quest', amount: 50 } });

    // ---- 1. 조회: 짝 닉네임, 친구를 끊으면 null
    const [e, f] = [await mk('e'), await mk('f')];
    await seedLessons(e.id, 1);
    await seedLessons(f.id, 1);
    assert.equal(await friendOf(e), null, '친구가 되기 전엔 friend null');
    await befriend(e, f);
    const view = await eventually(() => friendOf(e), '친구 퀘스트 생성');
    assert.equal(view.partner.nickname, f.nick, 'friend.partner.nickname은 짝의 닉네임');
    assert.deepEqual([view.mine, view.theirs, view.goal, view.done], [1, 1, 15, false]);
    assert.equal(view.endsAt, weekRangeUtc(week).to.toISOString(), 'endsAt은 서울 다음 월요일 00:00');
    await e.call('DELETE', `/friends/${f.id}`);
    await eventually(async () => (await friendOf(e)) === null, '친구 퀘스트 종료');
    assert.equal(await friendOf(f), null, '끝난 퀘스트는 양쪽 모두 null');

    // ---- 2~3. A-B: 7+7 + A 완료 → 둘 다 지급, B 이어서 완료 → 추가 지급 없음
    const [a, b] = [await mk('a'), await mk('b')];
    await seedLessons(a.id, 7);
    await seedLessons(b.id, 7);
    await befriend(a, b);
    await eventually(() => friendOf(a), '친구 퀘스트 생성');
    const aDone = await completeLesson(a.call);
    assert.equal(friendRewards(aDone).length, 1, 'A 응답에 friend 보상 1개');
    assert.deepEqual(friendRewards(aDone)[0], { key: 'friend', title: '친구와 레슨 15개', xp: 50 });
    for (const u of [a, b]) {
      assert.equal(await rewardRows(u.id), 1, `${u.nick} quest_rewards(friend) 1행`);
      assert.equal(await rewardXp(u.id), 1, `${u.nick} xp_events(quest, 50) 1행`);
    }
    assert.equal((await friendOf(a))!.done, true);
    const bDone = await completeLesson(b.call);
    assert.equal(friendRewards(bDone).length, 0, 'B 응답에는 friend 보상 없음');
    for (const u of [a, b]) {
      assert.equal(await rewardRows(u.id), 1, '행 수 그대로');
      assert.equal(await rewardXp(u.id), 1);
    }

    // ---- 4. C-D 14개 상태에서 동시 완료
    const [c, d] = [await mk('c'), await mk('d')];
    await seedLessons(c.id, 7);
    await seedLessons(d.id, 7);
    await befriend(c, d);
    await eventually(() => friendOf(c), '친구 퀘스트 생성');
    const [cDone, dDone] = await Promise.all([completeLesson(c.call), completeLesson(d.call)]);
    for (const u of [c, d]) {
      assert.equal(await rewardRows(u.id), 1, `${u.nick} 동시 완료 뒤 quest_rewards(friend) 1행`);
      assert.equal(await rewardXp(u.id), 1, `${u.nick} xp_events(quest, 50) 1행`);
    }
    assert.ok(friendRewards(cDone).length + friendRewards(dDone).length >= 1, '둘 중 합계를 채운 쪽 응답에는 friend 보상이 실린다');
    assert.ok(friendRewards(cDone).length <= 1 && friendRewards(dDone).length <= 1);

    console.log('friend-quests e2e OK');
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
