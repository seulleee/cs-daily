/**
 * E2E: 레슨 이어 풀기 (CI 전용 — 실제 Postgres + 빌드된 서버에 HTTP로 요청)
 *
 * 웹 플레이어는 GET /sessions/:id의 answered로 "답하지 않은 첫 문제"를 정한다. 서버가 그 값을 맞게 주는지 보증한다.
 *  1. 레슨 시작 → 3문제 답 → GET /sessions/:id: answered 3개(제출한 문제·채점 결과 그대로), 첫 미답 문제는 4번째
 *  2. 같은 레슨 세션을 다시 시작해도 같은 세션이 이어진다(answered 3개 유지)
 *  3. 이미 답한 문제를 다시 제출하면 409 ANSWER_ALREADY_SUBMITTED, 기록은 그대로 (중복 채점 방지)
 */
import { PrismaClient } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import assert from 'node:assert/strict';

const API = process.env.E2E_API_URL ?? 'http://localhost:4000';
const prisma = new PrismaClient();

type Session = { id: string; questions: { id: string }[]; answered: { questionId: string; isCorrect: boolean; correctAnswer: unknown; explanation: string }[] };
type Graded = { isCorrect: boolean };

async function main() {
  const user = await prisma.user.create({ data: { email: `e2e-resume-${Date.now()}@example.test`, nickname: `e2er${Date.now() % 1e9}` } });
  const token = new JwtService({ secret: process.env.JWT_ACCESS_SECRET }).sign({ sub: user.id, role: 'user' }, { expiresIn: '10m' });
  const raw = async (method: string, path: string, body?: unknown) => {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, json: text ? JSON.parse(text) : undefined, text };
  };
  const call = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
    const r = await raw(method, path, body);
    assert.ok(r.status >= 200 && r.status < 300, `${method} ${path} → ${r.status} ${r.text}`);
    return r.json as T;
  };

  try {
    const track = await prisma.track.findUniqueOrThrow({ where: { slug: 'dsa' }, include: { units: { where: { sortOrder: { gt: 0 } }, orderBy: { sortOrder: 'asc' }, take: 1, include: { lessons: { where: { sortOrder: { gt: 0 } }, orderBy: { sortOrder: 'asc' }, take: 1 } } } } });
    const lesson = track.units[0]?.lessons[0];
    assert.ok(lesson, 'dsa 첫 레슨');

    // 정답 여부는 상관없으니 문제 유형에 맞는 형태의 답이면 된다 (정답 키가 있으면 맞히고, 없으면 아무 값)
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
    const submit = async (sessionId: string, questionId: string) =>
      raw('POST', `/sessions/${sessionId}/answers`, { questionId, answer: await answerFor(questionId), timeMs: 1000 });

    // 1. 3문제 답한 뒤의 GET
    const s = await call<Session>('POST', `/lessons/${lesson.id}/sessions`);
    assert.ok(s.questions.length >= 4, '문제 4개 이상');
    assert.equal(s.answered.length, 0);
    const firstThree = s.questions.slice(0, 3).map((q) => q.id);
    const graded: Graded[] = [];
    for (const id of firstThree) {
      const r = await submit(s.id, id);
      assert.ok(r.status === 200 || r.status === 201, `제출 → ${r.status} ${r.text}`);
      graded.push(r.json as Graded);
    }
    const again = await call<Session>('GET', `/sessions/${s.id}`);
    assert.equal(again.answered.length, 3, 'answered 3개');
    assert.deepEqual(again.answered.map((a) => a.questionId).sort(), [...firstThree].sort());
    for (const [i, id] of firstThree.entries()) {
      assert.equal(again.answered.find((a) => a.questionId === id)!.isCorrect, graded[i]!.isCorrect, '채점 결과 일치');
    }
    const answeredIds = new Set(again.answered.map((a) => a.questionId));
    const firstUnanswered = again.questions.findIndex((q) => !answeredIds.has(q.id));
    assert.equal(firstUnanswered, 3, '첫 미답 문제는 4번째');

    // 2. 같은 레슨 세션 재시작 → 같은 세션
    const resumed = await call<Session>('POST', `/lessons/${lesson.id}/sessions`);
    assert.equal(resumed.id, s.id, '열린 세션이 이어진다');
    assert.equal(resumed.answered.length, 3);

    // 3. 중복 제출은 409, 기록은 그대로
    const dup = await submit(s.id, firstThree[0]!);
    assert.equal(dup.status, 409);
    assert.equal(dup.json?.error?.code, 'ANSWER_ALREADY_SUBMITTED');
    const after = await call<Session>('GET', `/sessions/${s.id}`);
    assert.equal(after.answered.length, 3, '중복 제출은 기록을 늘리지 않는다');

    console.log('✓ resume session e2e passed');
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
