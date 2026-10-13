/**
 * E2E: 유닛 건너뛰기 테스트 (CI 전용 — 실제 Postgres + 빌드된 서버에 HTTP로 요청)
 *
 * 전제: 마이그레이션·시드 완료된 DB, `node dist/main.js`가 E2E_API_URL에서 떠 있음.
 * 실행: pnpm --filter @cs-daily/api test:e2e
 *
 * 시나리오 (dsa 트랙)
 *  0. 콘텐츠에서 빠진 퇴역 행(sortOrder 음수)을 만들어 두고, 경로·카운트·잠금·레슨 시작에서 보이지 않음을 확인
 *  1. 유닛 2 건너뛰기 테스트를 1문제만 틀리고 통과 → 유닛 1~2의 레슨 6개 완료, 유닛 3 첫 레슨이 열림
 *  2. 같은 유닛 레슨 세션을 시작해도 건너뛰기 세션이 이어지지 않는다 (kind 분리)
 *  3. 유닛 3 테스트를 전부 틀림 → 불합격, 완료 처리 없음, XP 0
 */
import { PrismaClient } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import assert from 'node:assert/strict';

const API = process.env.E2E_API_URL ?? 'http://localhost:4000';
const prisma = new PrismaClient();

type Session = { id: string; kind: string; lessonId: number | null; lessonName: string | null; questions: { id: string; type: string }[] };
type Complete = { correct: number; total: number; xpEarned: number; placement: { passed: boolean; skippedLessons: number; unitName: string } | null };
type Path = {
  track: { unitCount: number; lessonCount: number };
  nextLessonId: number | null;
  units: { id: number; sortOrder: number; lessons: { id: number; status: string }[] }[];
};

async function main() {
  const user = await prisma.user.create({ data: { email: `e2e-${Date.now()}@example.test`, nickname: `e2e${Date.now() % 1e9}` } });
  const token = new JwtService({ secret: process.env.JWT_ACCESS_SECRET }).sign({ sub: user.id, role: 'user' }, { expiresIn: '10m' });
  const call = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    assert.ok(res.ok, `${method} ${path} → ${res.status} ${text}`);
    return (text ? JSON.parse(text) : undefined) as T;
  };

  try {
    // sortOrder 음수 = 콘텐츠에서 빠진 퇴역 행(seed.ts 참고) — API와 같이 양수만 본다
    const track = await prisma.track.findUniqueOrThrow({ where: { slug: 'dsa' }, include: { units: { where: { sortOrder: { gt: 0 } }, orderBy: { sortOrder: 'asc' } } } });
    const [u1, u2, u3] = track.units;
    assert.ok(u1 && u2 && u3, 'dsa 트랙에 유닛 3개 이상');

    const answerFor = async (questionId: string, correct: boolean) => {
      const q = await prisma.question.findUniqueOrThrow({ where: { id: questionId }, select: { type: true, answerKey: true, content: true } });
      const key = q.answerKey as Record<string, unknown>;
      const opts = ((q.content as { options?: string[] }).options ?? []).length;
      switch (q.type) {
        case 'single': {
          const i = key.index as number;
          return { index: correct ? i : (i + 1) % opts };
        }
        case 'multi': {
          const ids = key.indices as number[];
          return { indices: correct ? ids : [...Array(opts).keys()].filter((i) => !ids.includes(i)).slice(0, 1) };
        }
        case 'ox':
          return { value: correct ? key.value : !key.value };
        default:
          return { text: correct ? (key.accepted as string[])[0] : '틀린답' };
      }
    };
    const solve = async (s: Session, wrongCount: number) => {
      for (const [i, q] of s.questions.entries()) {
        await call('POST', `/sessions/${s.id}/answers`, { questionId: q.id, answer: await answerFor(q.id, i >= wrongCount), timeMs: 1000 });
      }
      return call<Complete>('POST', `/sessions/${s.id}/complete`);
    };

    // 0. 퇴역 행 숨김. 퇴역 레슨(유닛 1 안, 순서 음수)과 퇴역 유닛(순서 음수, 그 레슨의 순서는 양수 — 유닛째 콘텐츠에서 빠진 경우)을 직접 만든다.
    //    음수 순서는 "바로 앞 레슨"·경로 맨 앞으로 잡히기 쉬워, 필터가 빠지면 첫 레슨이 영원히 잠긴다
    const retiredUnit = await prisma.unit.create({ data: { trackId: track.id, slug: 'e2e-retired-unit', name: 'e2e 퇴역 유닛', sortOrder: -999 } });
    const retiredUnitLesson = await prisma.lesson.create({ data: { unitId: retiredUnit.id, slug: 'e2e-retired-1', name: 'e2e 퇴역 유닛의 레슨', sortOrder: 1 } });
    const retiredLesson = await prisma.lesson.create({ data: { unitId: u1.id, slug: 'e2e-retired-lesson', name: 'e2e 퇴역 레슨', sortOrder: -999 } });
    const positiveLessonCount = await prisma.lesson.count({ where: { sortOrder: { gt: 0 }, unit: { trackId: track.id, sortOrder: { gt: 0 } } } });

    const path0 = await call<Path>('GET', '/me/path?track=dsa');
    assert.ok(!path0.units.some((u) => u.id === retiredUnit.id), '퇴역 유닛은 경로에 없다');
    const pathLessonIds = path0.units.flatMap((u) => u.lessons.map((l) => l.id));
    assert.ok(!pathLessonIds.includes(retiredLesson.id), '퇴역 레슨은 경로에 없다');
    assert.ok(!pathLessonIds.includes(retiredUnitLesson.id), '퇴역 유닛의 레슨은 경로에 없다');
    assert.equal(path0.units[0]!.id, u1.id, '경로 첫 유닛');
    const firstLesson = path0.units[0]!.lessons[0]!;
    assert.equal(firstLesson.status, 'available', '퇴역 레슨이 앞에 있어도 첫 레슨은 열려 있다');
    assert.equal(path0.nextLessonId, firstLesson.id, '다음 레슨은 첫 레슨');
    assert.equal(path0.track.unitCount, track.units.length, '경로 유닛 수에 퇴역 유닛 제외');
    assert.equal(path0.track.lessonCount, positiveLessonCount, '경로 레슨 수에 퇴역 레슨 제외');
    const listed = (await call<{ slug: string; unitCount: number; lessonCount: number }[]>('GET', '/tracks')).find((t) => t.slug === 'dsa')!;
    assert.equal(listed.unitCount, track.units.length, '트랙 목록 유닛 수에 퇴역 유닛 제외');
    assert.equal(listed.lessonCount, positiveLessonCount, '트랙 목록 레슨 수에 퇴역 레슨 제외');
    for (const id of [retiredLesson.id, retiredUnitLesson.id]) {
      const res = await fetch(`${API}/lessons/${id}/sessions`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' } });
      assert.equal(res.status, 404, `퇴역 레슨 ${id} 시작은 없는 레슨(404): ${res.status}`);
    }
    const retiredUnitSkip = await fetch(`${API}/units/${retiredUnit.id}/skip-test`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' } });
    assert.equal(retiredUnitSkip.status, 404, `퇴역 유닛 건너뛰기는 없는 유닛(404): ${retiredUnitSkip.status}`);
    const firstSession = await call<Session>('POST', `/lessons/${firstLesson.id}/sessions`);
    assert.equal(firstSession.kind, 'lesson', '퇴역 행이 앞에 있어도 첫 레슨을 시작할 수 있다(잠금 계산에서 제외)');

    // 1. 유닛 2 통과
    const s1 = await call<Session>('POST', `/units/${u2.id}/skip-test`);
    assert.equal(s1.kind, 'placement');
    assert.equal(s1.lessonName, u2.name);
    assert.ok(s1.questions.length >= 5 && s1.questions.length <= 8, `문제 수 ${s1.questions.length}`);
    const again = await call<Session>('POST', `/units/${u2.id}/skip-test`);
    assert.equal(again.id, s1.id, '미완료 테스트는 이어서 푼다');
    const r1 = await solve(s1, 1);
    assert.ok(r1.placement?.passed, `통과해야 함: ${JSON.stringify(r1)}`);
    assert.equal(r1.xpEarned, 0, '건너뛰기 테스트는 XP 없음');
    const lessonsThroughU2 = await prisma.lesson.count({ where: { unitId: { in: [u1.id, u2.id] }, sortOrder: { gt: 0 } } });
    assert.equal(r1.placement?.skippedLessons, lessonsThroughU2);

    const path = await call<Path>('GET', '/me/path?track=dsa');
    const st = (unitId: number) => path.units.find((u) => u.id === unitId)!.lessons.map((l) => l.status);
    assert.ok(st(u1.id).every((s) => s === 'completed'), `유닛1: ${st(u1.id)}`);
    assert.ok(st(u2.id).every((s) => s === 'completed'), `유닛2: ${st(u2.id)}`);
    assert.equal(st(u3.id)[0], 'available', `유닛3 첫 레슨: ${st(u3.id)}`);

    // 2. 레슨 세션과 섞이지 않음 (유닛 3 테스트를 열어 둔 채 유닛 3 마지막 레슨 대신 첫 레슨 시작)
    const s3 = await call<Session>('POST', `/units/${u3.id}/skip-test`);
    const lesson = await call<Session>('POST', `/lessons/${path.units.find((u) => u.id === u3.id)!.lessons[0]!.id}/sessions`);
    assert.equal(lesson.kind, 'lesson');
    assert.notEqual(lesson.id, s3.id);

    // 2-1. 틀린 문제 다시 풀기: 첫 답이 오답인 문제만 허용, 점수에는 영향 없음
    const lq = lesson.questions[0]!;
    await call('POST', `/sessions/${lesson.id}/answers`, { questionId: lq.id, answer: await answerFor(lq.id, false), timeMs: 1000 });
    const retryOk = await call<{ isCorrect: boolean }>('POST', `/sessions/${lesson.id}/retry`, { questionId: lq.id, answer: await answerFor(lq.id, true) });
    assert.equal(retryOk.isCorrect, true, '재도전 채점');
    const retryOnCorrect = await fetch(`${API}/sessions/${lesson.id}/retry`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ questionId: lesson.questions[1]!.id, answer: await answerFor(lesson.questions[1]!.id, true) }),
    });
    assert.equal(retryOnCorrect.status, 403, '아직 답하지 않은 문제는 재도전 불가');
    const answers = await prisma.answer.count({ where: { sessionId: lesson.id } });
    assert.equal(answers, 1, '재도전은 답안을 남기지 않는다');
    assert.ok((lesson as unknown as { lessonObjective: string | null }).lessonObjective, '레슨 세션에는 학습 목표가 실린다');
    assert.ok(Array.isArray((lesson as unknown as { lessonKeyPoints: string[] }).lessonKeyPoints), '레슨 세션에는 핵심 정리 배열이 실린다(비어 있어도 됨)');

    // 3. 유닛 3 전부 오답 → 불합격
    const r3 = await solve(s3, s3.questions.length);
    assert.equal(r3.placement?.passed, false);
    assert.equal(r3.placement?.skippedLessons, 0);
    const done3 = await prisma.userLessonProgress.count({ where: { userId: user.id, lesson: { unitId: u3.id }, completedAt: { not: null } } });
    assert.equal(done3, 0, '불합격이면 유닛 3 완료 처리 없음');

    console.log('✓ unit skip test e2e passed');
  } finally {
    // 시나리오 0에서 만든 퇴역 행 정리 (레슨 → 유닛 순서)
    await prisma.lesson.deleteMany({ where: { slug: { startsWith: 'e2e-retired' } } });
    await prisma.unit.deleteMany({ where: { slug: 'e2e-retired-unit' } });
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
