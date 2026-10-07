/**
 * E2E: 유닛 건너뛰기 테스트 (CI 전용 — 실제 Postgres + 빌드된 서버에 HTTP로 요청)
 *
 * 전제: 마이그레이션·시드 완료된 DB, `node dist/main.js`가 E2E_API_URL에서 떠 있음.
 * 실행: pnpm --filter @cs-daily/api test:e2e
 *
 * 시나리오 (dsa 트랙)
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
type Path = { units: { id: number; sortOrder: number; lessons: { id: number; status: string }[] }[] };

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
    const track = await prisma.track.findUniqueOrThrow({ where: { slug: 'dsa' }, include: { units: { orderBy: { sortOrder: 'asc' } } } });
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
    const lessonsThroughU2 = await prisma.lesson.count({ where: { unitId: { in: [u1.id, u2.id] } } });
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

    // 3. 유닛 3 전부 오답 → 불합격
    const r3 = await solve(s3, s3.questions.length);
    assert.equal(r3.placement?.passed, false);
    assert.equal(r3.placement?.skippedLessons, 0);
    const done3 = await prisma.userLessonProgress.count({ where: { userId: user.id, lesson: { unitId: u3.id }, completedAt: { not: null } } });
    assert.equal(done3, 0, '불합격이면 유닛 3 완료 처리 없음');

    console.log('✓ unit skip test e2e passed');
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
