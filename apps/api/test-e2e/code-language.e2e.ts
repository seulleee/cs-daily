/**
 * E2E: 코딩 테스트(ct) 코드 문제 언어 선택 (CI 전용 — 실제 Postgres + 빌드된 서버에 HTTP로 요청)
 *
 * ct 트랙 콘텐츠가 아직 없어도 돌도록 테스트용 트랙·레슨·문제를 DB에 직접 만들고(실제 콘텐츠 파일과 같은 QuestionFile 스키마로 검증),
 * 끝나면 지운다.
 *
 *  1. 기본 언어(python) 사용자 → python 코드만 받는다. 다른 언어 코드·정답은 응답 어디에도 없다
 *  2. lang 없이 제출 → 422 CODE_LANGUAGE_UNAVAILABLE, 모르는 lang → 400
 *  3. python으로 제출·채점 → 정답, 응답의 correctAnswer에는 python 정답만
 *  4. PATCH /me 로 java로 바꾼 뒤 같은 세션을 다시 열면: 이미 답한 문제는 python 그대로, 남은 문제는 java 코드
 *  5. 새 세션 → java 코드, java 정답으로 채점(python 정답은 오답)
 *  6. 일반(variants 없는) 문제는 언어와 무관하게 하나
 */
import { PrismaClient, type Prisma } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { QuestionFile } from '@cs-daily/contracts';
import assert from 'node:assert/strict';

const API = process.env.E2E_API_URL ?? 'http://localhost:4000';
const prisma = new PrismaClient();

type Q = { id: string; type: string; lang?: string; content: { prompt: string; code?: { language: string; source: string }; options?: string[] } };
type Session = { id: string; questions: Q[]; answered: { questionId: string; isCorrect: boolean; correctAnswer: unknown; explanation: string }[] };
type Graded = { isCorrect: boolean; correctAnswer: unknown; explanation: string };

const fixtures = [
  {
    id: 'ct-e2elist-001',
    type: 'fill',
    difficulty: 1,
    tags: ['e2e'],
    content: {
      prompt: '리스트 끝에 3을 추가하는 메서드는?',
      variants: {
        python: { code: { language: 'python', source: 'a = [1, 2]\na.___(3)' } },
        java: { code: { language: 'java', source: 'List<Integer> a = new ArrayList<>();\na.___(3);' } },
        javascript: { code: { language: 'javascript', source: 'const a = [1, 2];\na.___(3);' } },
        cpp: { code: { language: 'cpp', source: 'vector<int> a = {1, 2};\na.___(3);' } },
      },
    },
    answer_key: {
      variants: {
        python: { accepted: ['append'] },
        java: { accepted: ['add'] },
        javascript: { accepted: ['push'] },
        cpp: { accepted: ['push_back'] },
      },
    },
    explanation: '리스트 끝에 원소를 넣는 메서드 이름은 언어마다 다르다.',
    refs: [],
  },
  {
    id: 'ct-e2eplain-002',
    type: 'ox',
    difficulty: 1,
    tags: ['e2e'],
    content: { prompt: '배열의 인덱스는 보통 0부터 시작한다.' },
    answer_key: { value: true },
    explanation: '대부분의 언어에서 배열 인덱스는 0부터 시작한다.',
    refs: [],
  },
  {
    id: 'ct-e2esingle-003',
    type: 'single',
    difficulty: 1,
    tags: ['e2e'],
    content: {
      prompt: '출력되는 값은?',
      options: ['3', '3.5'],
      variants: {
        python: { code: { language: 'python', source: 'print(7 // 2)' } },
        java: { code: { language: 'java', source: 'System.out.println(7 / 2);' } },
        javascript: { code: { language: 'javascript', source: 'console.log(7 / 2);' } },
        cpp: { code: { language: 'cpp', source: 'cout << 7 / 2;' } },
      },
    },
    answer_key: { variants: { python: { index: 0 }, java: { index: 0 }, javascript: { index: 1 }, cpp: { index: 0 } } },
    explanation: 'JavaScript는 정수 나눗셈이 없어 7 / 2가 3.5이고 나머지 언어는 정수 몫 3이다.',
    refs: [],
  },
];

async function main() {
  for (const f of fixtures) assert.ok(QuestionFile.safeParse(f).success, `픽스처 ${f.id}가 콘텐츠 스키마를 통과해야 한다`);

  const user = await prisma.user.create({ data: { email: `e2e-ctlang-${Date.now()}@example.test`, nickname: `ct${Date.now() % 1e9}` } });
  const token = new JwtService({ secret: process.env.JWT_ACCESS_SECRET }).sign({ sub: user.id, role: 'user' }, { expiresIn: '10m' });
  const raw = async (method: string, path: string, body?: unknown) => {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, text, json: text ? (JSON.parse(text) as unknown) : undefined };
  };
  const call = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
    const r = await raw(method, path, body);
    assert.ok(r.status < 300, `${method} ${path} → ${r.status} ${r.text}`);
    return r.json as T;
  };

  const track = await prisma.track.create({ data: { slug: 'e2e-ct', name: 'e2e ct', sortOrder: 9999, isActive: true } });
  try {
    const unit = await prisma.unit.create({ data: { trackId: track.id, slug: 'e2e-u1', name: 'e2e 유닛', sortOrder: 1 } });
    const lesson = await prisma.lesson.create({ data: { unitId: unit.id, slug: 'e2e-l1', name: 'e2e 레슨', sortOrder: 1, questionCount: fixtures.length } });
    for (const [i, f] of fixtures.entries()) {
      await prisma.question.create({
        data: {
          contentId: f.id,
          lessonId: lesson.id,
          type: f.type as 'fill' | 'ox' | 'single',
          content: f.content as Prisma.InputJsonValue,
          answerKey: f.answer_key as Prisma.InputJsonValue,
          explanation: f.explanation,
          difficulty: f.difficulty,
          tags: f.tags,
          sortOrder: i + 1,
          status: 'published',
        },
      });
    }
    const idOf = async (contentId: string) => (await prisma.question.findUniqueOrThrow({ where: { contentId }, select: { id: true } })).id;
    const [fillId, plainId, singleId] = [await idOf('ct-e2elist-001'), await idOf('ct-e2eplain-002'), await idOf('ct-e2esingle-003')];
    const answer = (sessionId: string, questionId: string, ans: unknown, lang?: string) =>
      raw('POST', `/sessions/${sessionId}/answers`, { questionId, answer: ans, timeMs: 1000, ...(lang ? { lang } : {}) });

    // 1. 기본 언어 python
    const me0 = await call<{ user: { codeLanguage: string } }>('GET', '/me');
    assert.equal(me0.user.codeLanguage, 'python', '기본 언어는 python');
    const s1 = await call<Session>('POST', `/lessons/${lesson.id}/sessions`);
    const fill1 = s1.questions.find((q) => q.id === fillId)!;
    assert.equal(fill1.lang, 'python');
    assert.equal(fill1.content.code?.language, 'python');
    assert.match(fill1.content.code!.source, /a\.___\(3\)/);
    const single1 = s1.questions.find((q) => q.id === singleId)!;
    assert.equal(single1.content.code?.language, 'python');
    assert.deepEqual(single1.content.options, ['3', '3.5']);
    assert.ok(!('lang' in s1.questions.find((q) => q.id === plainId)!), '일반 문제에는 lang이 없다');
    assert.ok(!/ArrayList|const a|vector|push_back|variants|accepted|answer_key|System\.out|console\.log|cout/.test(JSON.stringify(s1)), '다른 언어 코드·정답은 세션 응답에 없다');

    // 2. lang 없이/모르는 lang 제출
    const noLang = await answer(s1.id, fillId, { text: 'append' });
    assert.equal(noLang.status, 422, `lang 없는 variants 제출: ${noLang.status} ${noLang.text}`);
    assert.match(noLang.text, /CODE_LANGUAGE_UNAVAILABLE/);
    const badLang = await answer(s1.id, fillId, { text: 'append' }, 'cobol');
    assert.equal(badLang.status, 400, `모르는 lang: ${badLang.status}`);
    assert.equal(await prisma.answer.count({ where: { sessionId: s1.id } }), 0, '거부된 제출은 기록되지 않는다');

    // 3. python으로 채점
    const g1 = (await answer(s1.id, fillId, { text: 'append' }, 'python')).json as Graded;
    assert.equal(g1.isCorrect, true);
    assert.deepEqual(g1.correctAnswer, { accepted: ['append'] });
    assert.ok(!/push|add/.test(JSON.stringify(g1)), '채점 응답에 다른 언어 정답이 없다');
    const stored = await prisma.answer.findFirstOrThrow({ where: { sessionId: s1.id, questionId: fillId } });
    assert.equal((stored.userAnswer as { lang?: string }).lang, 'python', '답안 기록에 채점 언어가 남는다');

    // 4. 세션 도중 java로 변경 → 이어 풀기
    await call('PATCH', '/me', { codeLanguage: 'java' });
    assert.equal((await call<{ user: { codeLanguage: string } }>('GET', '/me')).user.codeLanguage, 'java');
    const s1b = await call<Session>('GET', `/sessions/${s1.id}`);
    assert.equal(s1b.questions.find((q) => q.id === fillId)!.content.code?.language, 'python', '이미 답한 문제는 답한 언어 그대로');
    assert.deepEqual(s1b.answered[0]!.correctAnswer, { accepted: ['append'] });
    const single1b = s1b.questions.find((q) => q.id === singleId)!;
    assert.equal(single1b.lang, 'java', '아직 안 푼 문제는 바뀐 설정의 언어');
    assert.equal(single1b.content.code?.language, 'java');
    assert.equal((await answer(s1.id, plainId, { value: true })).status, 201,'일반 문제는 lang 없이 제출');
    const g1c = (await answer(s1.id, singleId, { index: 0 }, 'java')).json as Graded;
    assert.equal(g1c.isCorrect, true);
    await call('POST', `/sessions/${s1.id}/complete`);

    // 5. 새 세션 → java
    const s2 = await call<Session>('POST', `/lessons/${lesson.id}/sessions`);
    assert.notEqual(s2.id, s1.id);
    const fill2 = s2.questions.find((q) => q.id === fillId)!;
    assert.equal(fill2.lang, 'java');
    assert.equal(fill2.content.code?.language, 'java');
    assert.match(fill2.content.code!.source, /ArrayList/);
    assert.ok(!/append|push|vector|console/.test(JSON.stringify(s2)), '새 세션 응답에 python·js·cpp 코드가 없다');
    const wrong = (await answer(s2.id, fillId, { text: 'append' }, 'java')).json as Graded;
    assert.equal(wrong.isCorrect, false, 'java 문제에 python 정답은 오답');
    assert.deepEqual(wrong.correctAnswer, { accepted: ['add'] });
    const retryOk = await raw('POST', `/sessions/${s2.id}/retry`, { questionId: fillId, answer: { text: 'add' }, lang: 'java' });
    assert.equal((retryOk.json as Graded).isCorrect, true, '재도전도 같은 언어 variant로 채점');
    const retryNoLang = await raw('POST', `/sessions/${s2.id}/retry`, { questionId: fillId, answer: { text: 'add' } });
    assert.equal(retryNoLang.status, 422, '재도전도 lang 없으면 거부');

    // javascript의 정수 나눗셈 차이 (single 정답 위치가 언어마다 다르다)
    await call('PATCH', '/me', { codeLanguage: 'javascript' });
    const s2b = await call<Session>('GET', `/sessions/${s2.id}`);
    const jsSingle = s2b.questions.find((q) => q.id === singleId)!;
    assert.equal(jsSingle.content.code?.language, 'javascript');
    const jsG = (await answer(s2.id, singleId, { index: 1 }, 'javascript')).json as Graded;
    assert.equal(jsG.isCorrect, true, 'javascript 정답은 index 1(3.5)');

    console.log('✓ ct code language e2e passed');
  } finally {
    // 사용자 삭제로 세션·답안·복습 항목이 함께 지워진 뒤 픽스처 정리 (문제 → 레슨 → 유닛 → 트랙)
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.question.deleteMany({ where: { contentId: { startsWith: 'ct-e2e' } } });
    await prisma.lesson.deleteMany({ where: { unit: { trackId: track.id } } });
    await prisma.unit.deleteMany({ where: { trackId: track.id } });
    await prisma.track.delete({ where: { id: track.id } });
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
