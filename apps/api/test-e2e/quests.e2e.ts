/**
 * E2E: 데일리 퀘스트 GET /me/quests · 세션 완료 시 지급 (CI 전용 — 실제 Postgres + 빌드된 서버에 HTTP로 요청)
 *  1. 레슨 1개 완료 → daily 3개, lessons 진행 1/2 (dailyGoal 1 → 목표 2)
 *  2. 같은 날 두 번째 완료 → questRewards에 lessons 정확히 1개, quest_rewards·xp_events(reason='quest') 일치
 *  3. 세 번째 완료 → questRewards에 lessons 없음 (중복 지급 없음)
 *  4. timezone이 America/Los_Angeles인 사용자의 로컬 전날 23:59 세션은 오늘 lessons 진행에 세지 않고, 오늘 00:01 세션은 센다
 *
 * 오늘의 퀘스트 3개는 사용자 id·날짜로 정해지므로, lessons가 (복습 자격 여부와 상관없이) 뽑히는 id를 골라 사용자를 만든다.
 */
import { PrismaClient } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { MeQuestsResponse, QuestRewardItem } from '@cs-daily/contracts';
import { localDateOf } from '../src/shared/domain/local-date';
import { pickDailyQuests } from '../src/modules/quests/domain/daily-quests';

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

/** lessons가 오늘의 3개에 들어가는 사용자 id (review 자격이 바뀌어도 유지) */
const idWithLessons = (today: string): string => {
  for (;;) {
    const id = randomUUID();
    if ([true, false].every((reviewEligible) => pickDailyQuests(id, today, { reviewEligible }).includes('lessons'))) return id;
  }
};

/** 사용자 로컬 오늘 00:00에 해당하는 순간 (정시 오프셋 타임존 기준) */
const localMidnight = (today: string, timeZone: string): Date => {
  const base = new Date(`${today}T00:00:00Z`).getTime();
  for (let h = 0; h <= 24; h++) {
    const t = new Date(base + h * 3_600_000);
    if (localDateOf(t, timeZone) === today) return t;
  }
  throw new Error('로컬 자정을 찾지 못함');
};

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
    /** 레슨 시작 → 전 문제 정답 → 완료 */
    const completeLesson = async (call: ReturnType<typeof asUser>): Promise<Completed> => {
      const s = await call<Session>('POST', `/lessons/${lesson.id}/sessions`);
      for (const q of s.questions) await call('POST', `/sessions/${s.id}/answers`, { questionId: q.id, answer: await answerFor(q.id), timeMs: 1000 });
      return call<Completed>('POST', `/sessions/${s.id}/complete`);
    };
    const lessonRewards = (c: Completed) => (c.questRewards ?? []).filter((r) => r.key === 'lessons');

    // ---- 1~3. Asia/Seoul 사용자
    const today = localDateOf(new Date(), 'Asia/Seoul');
    const userId = idWithLessons(today);
    ids.push(userId);
    await prisma.user.create({ data: { id: userId, email: `e2e-quests-${stamp}@example.test`, nickname: `e2eq${stamp % 1e8}` } });
    const call = asUser(userId);

    const first = await completeLesson(call);
    assert.equal(lessonRewards(first).length, 0, '첫 완료는 lessons 목표(2) 미달 — 지급 없음');
    const q1 = await call<MeQuestsResponse>('GET', '/me/quests');
    assert.equal(q1.daily.length, 3, '데일리 퀘스트 3개');
    assert.equal(q1.date, today);
    const lessons1 = q1.daily.find((q) => q.key === 'lessons')!;
    assert.equal(lessons1.progress, 1, 'lessons 진행 1');
    assert.equal(lessons1.goal, 2);

    const second = await completeLesson(call);
    assert.equal(lessonRewards(second).length, 1, '두 번째 완료에서 lessons 보상 정확히 1개');
    assert.equal(lessonRewards(second)[0]!.xp, 10);
    const rewardRows = await prisma.questReward.findMany({ where: { userId } });
    assert.equal(rewardRows.filter((r) => r.questKey === 'lessons').length, 1, 'quest_rewards lessons 1행');
    const questXp = await prisma.xpEvent.count({ where: { userId, reason: 'quest' } });
    assert.equal(questXp, rewardRows.length, 'xp_events(reason=quest)는 지급 기록과 1:1');
    assert.ok(questXp >= 1);

    const third = await completeLesson(call);
    assert.equal(lessonRewards(third).length, 0, '세 번째 완료엔 lessons 보상 없음 (중복 지급 없음)');
    const rewardsAfter = await prisma.questReward.count({ where: { userId } });
    assert.equal(await prisma.xpEvent.count({ where: { userId, reason: 'quest' } }), rewardsAfter, '세 번째 완료 뒤에도 quest XP는 지급 기록과 1:1');
    const lessonRowsAfter = await prisma.questReward.count({ where: { userId, questKey: 'lessons' } });
    assert.equal(lessonRowsAfter, 1, '여전히 lessons 지급 1행');

    // ---- 4. America/Los_Angeles: 로컬 전날 23:59는 오늘에 세지 않는다
    const tz = 'America/Los_Angeles';
    const laToday = localDateOf(new Date(), tz);
    const laId = idWithLessons(laToday);
    ids.push(laId);
    await prisma.user.create({ data: { id: laId, email: `e2e-quests-la-${stamp}@example.test`, nickname: `e2eql${stamp % 1e8}`, timezone: tz } });
    const prevEnd = new Date(localMidnight(laToday, tz).getTime() - 60_000);
    assert.equal(localDateOf(prevEnd, tz) < laToday, true, '시드 시각은 로컬 전날');
    await prisma.lessonSession.create({ data: { userId: laId, lessonId: lesson.id, kind: 'lesson', questionIds: [], startedAt: prevEnd, finishedAt: prevEnd } });
    const qla = await asUser(laId)<MeQuestsResponse>('GET', '/me/quests');
    assert.equal(qla.date, laToday, '퀘스트 날짜는 로컬 날짜');
    assert.equal(qla.daily.find((q) => q.key === 'lessons')!.progress, 0, '로컬 전날 23:59 세션은 오늘 진행에 세지 않는다');

    const dayStart = new Date(localMidnight(laToday, tz).getTime() + 60_000); // 로컬 오늘 00:01
    await prisma.lessonSession.create({ data: { userId: laId, lessonId: lesson.id, kind: 'lesson', questionIds: [], startedAt: dayStart, finishedAt: dayStart } });
    const qla2 = await asUser(laId)<MeQuestsResponse>('GET', '/me/quests');
    assert.equal(qla2.daily.find((q) => q.key === 'lessons')!.progress, 1, '로컬 오늘 00:01 세션은 오늘 lessons 진행에 센다');

    console.log('quests e2e OK');
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
