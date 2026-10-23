/**
 * E2E: 운영자 지표 GET /internal/stats (CI 전용 — 실제 Postgres + 빌드된 서버에 HTTP로 요청)
 *  1. 인증 없음·틀린 시크릿·사용자 JWT는 401, 응답에 이메일·닉네임·user id가 없다(집계만)
 *  2. 시드한 사용자들로 집계가 맞다 — CI DB엔 다른 e2e 사용자도 있으니 시드 전후 차이(delta)로 단언
 *     활성 1/7/30일(placement·미완료 세션 제외), 코호트 D1·D7, 트랙별 시작·완료, 스트릭 3/7
 */
import { PrismaClient } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import assert from 'node:assert/strict';
import { localDateOf } from '../src/shared/domain/local-date';
import { weekStartOf } from '../src/modules/jobs/domain/usage-stats';

const API = process.env.E2E_API_URL ?? 'http://localhost:4000';
const JOBS_SECRET = process.env.JOBS_SECRET ?? 'ci-jobs';
const prisma = new PrismaClient();
const jwt = new JwtService({ secret: process.env.JWT_ACCESS_SECRET });
const DAY = 86_400_000;

interface Cell { eligible: number; retained: number; rate: number | null }
interface Stats {
  users: { total: number; active1d: number; active7d: number; active30d: number };
  retention: { cohortWeeks: { weekStart: string; signups: number; d1: Cell; d7: Cell; d30: Cell }[] };
  tracks: { slug: string; startedUsers: number; completedLessons: number; completedLessonsLast7d: number }[];
  streaks: { atLeast3: number; atLeast7: number };
}

const asUser = (id: string) => {
  const token = jwt.sign({ sub: id, role: 'user' }, { expiresIn: '10m' });
  return async (method: string, path: string, body?: unknown) => {
    const res = await fetch(`${API}${path}`, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await res.text();
    return { status: res.status, json: text ? JSON.parse(text) : undefined, text };
  };
};
const getStats = async (): Promise<Stats> => {
  const res = await fetch(`${API}/internal/stats`, { headers: { authorization: `Bearer ${JOBS_SECRET}` } });
  const text = await res.text();
  assert.equal(res.status, 200, `GET /internal/stats → ${res.status} ${text}`);
  return JSON.parse(text) as Stats;
};

async function main() {
  // 사용자·활동을 만들기 전 스냅샷 — 이후 값은 전후 차이로 단언한다 (CI DB엔 다른 e2e 사용자가 있다)
  const before = await getStats();
  const stamp = Date.now();
  const mk = (tag: string, createdAt?: Date) =>
    prisma.user.create({ data: { email: `e2e-demand-${tag}-${stamp}@example.test`, nickname: `e2ed${tag}${stamp % 1e8}`, ...(createdAt ? { createdAt } : {}) } });
  const now = new Date();
  const signupAt = new Date(now.getTime() - 10 * DAY);
  const [a, b, c] = [await mk('a', signupAt), await mk('b', signupAt), await mk('c')];
  const ids = [a.id, b.id, c.id];

  try {
    // ---- 1. 인증
    for (const headers of [{}, { authorization: 'Bearer wrong' }, { authorization: JOBS_SECRET }] as Record<string, string>[]) {
      const res = await fetch(`${API}/internal/stats`, { headers });
      assert.equal(res.status, 401, `인증 실패는 401 (${JSON.stringify(Object.keys(headers))})`);
    }
    const jwtOnly = await fetch(`${API}/internal/stats`, { headers: { authorization: `Bearer ${jwt.sign({ sub: a.id, role: 'admin' })}` } });
    assert.equal(jwtOnly.status, 401, '사용자 JWT(admin 포함)로는 접근 불가');

    // ---- 2. 집계
    const dsa = await prisma.track.findUniqueOrThrow({ where: { slug: 'dsa' }, select: { id: true, units: { where: { sortOrder: { gt: 0 } }, orderBy: { sortOrder: 'asc' }, take: 1, select: { lessons: { where: { sortOrder: { gt: 0 } }, orderBy: { sortOrder: 'asc' }, take: 3, select: { id: true } } } } } });
    const lessons = dsa.units[0]!.lessons;
    assert.ok(lessons.length >= 3, 'dsa 첫 유닛에 레슨 3개');
    const session = (userId: string, finishedAt: Date | null, kind: 'lesson' | 'review' | 'placement' = 'lesson') =>
      prisma.lessonSession.create({ data: { userId, lessonId: lessons[0]!.id, kind, questionIds: [], startedAt: finishedAt ?? now, finishedAt } });

    // A·B: 10일 전 가입. A는 D1(가입 +1일)·D7(+7일)에 세션을 끝냈다. B는 placement·미완료 세션만(재방문 아님)
    await session(a.id, new Date(signupAt.getTime() + 1 * DAY));
    await session(a.id, new Date(signupAt.getTime() + 7 * DAY), 'review');
    await session(b.id, new Date(signupAt.getTime() + 1 * DAY), 'placement');
    await session(b.id, null);
    // C: 방금 가입, 2시간 전 레슨 완료 → 1·7·30일 활성
    await session(c.id, new Date(now.getTime() - 2 * 3_600_000));

    await prisma.userTrack.createMany({ data: [{ userId: a.id, trackId: dsa.id }, { userId: c.id, trackId: dsa.id }] });
    await prisma.userLessonProgress.createMany({
      data: [
        { userId: a.id, lessonId: lessons[0]!.id, completedAt: new Date(now.getTime() - 2 * DAY) },
        { userId: a.id, lessonId: lessons[1]!.id, completedAt: new Date(now.getTime() - 20 * DAY) },
        { userId: c.id, lessonId: lessons[2]!.id, completedAt: null }, // 미완료는 세지 않는다
      ],
    });
    await prisma.userStats.createMany({ data: [{ userId: a.id, currentStreak: 7 }, { userId: c.id, currentStreak: 3 }, { userId: b.id, currentStreak: 2 }] });

    const after = await getStats();
    const d = (x: number, y: number) => x - y;

    assert.equal(d(after.users.total, before.users.total), 3, '가입자 수: A·B·C');
    assert.equal(d(after.users.active1d, before.users.active1d), 1, '활성 1일: C');
    assert.equal(d(after.users.active7d, before.users.active7d), 2, '활성 7일: A(3일 전)·C. B는 placement·미완료라 제외');
    assert.equal(d(after.users.active30d, before.users.active30d), 2, '활성 30일');

    const week = weekStartOf(localDateOf(signupAt, 'Asia/Seoul'));
    const cw = (s: Stats) => s.retention.cohortWeeks.find((w) => w.weekStart === week)!;
    assert.ok(cw(after) && cw(before), `코호트 주 ${week} 존재`);
    assert.equal(d(cw(after).signups, cw(before).signups), 2, '코호트 가입자: A·B');
    assert.equal(d(cw(after).d1.eligible, cw(before).d1.eligible), 2);
    assert.equal(d(cw(after).d1.retained, cw(before).d1.retained), 1, 'D1 재방문: A');
    assert.equal(d(cw(after).d7.eligible, cw(before).d7.eligible), 2);
    assert.equal(d(cw(after).d7.retained, cw(before).d7.retained), 1, 'D7 재방문: A');
    assert.equal(d(cw(after).d30.eligible, cw(before).d30.eligible), 0, '가입 10일차는 D30 관측 불가');

    const tr = (s: Stats) => s.tracks.find((t) => t.slug === 'dsa')!;
    assert.equal(d(tr(after).startedUsers, tr(before).startedUsers), 2, 'dsa 시작: A·C');
    assert.equal(d(tr(after).completedLessons, tr(before).completedLessons), 2, 'dsa 완료 레슨 2 (미완료 제외)');
    assert.equal(d(tr(after).completedLessonsLast7d, tr(before).completedLessonsLast7d), 1, '최근 7일 완료 1');

    assert.equal(d(after.streaks.atLeast3, before.streaks.atLeast3), 2, '스트릭 3+: A(7)·C(3)');
    assert.equal(d(after.streaks.atLeast7, before.streaks.atLeast7), 1, '스트릭 7+: A');

    // 개인 식별 정보 없음
    const raw = JSON.stringify(after);
    for (const u of [a, b, c]) {
      for (const needle of [u.id, u.email, u.nickname]) assert.ok(!raw.includes(needle), `응답에 개인 식별 정보가 없다: ${needle.slice(0, 8)}`);
    }
    console.log('demand e2e OK');
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
