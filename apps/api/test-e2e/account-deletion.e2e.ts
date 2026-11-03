/**
 * E2E: 계정 탈퇴 DELETE /me (CI 전용 — 실제 Postgres + 빌드된 서버에 HTTP로 요청)
 *  1. A-B 친구, A에게 세션 몇 개, 친구 퀘스트 생성 → B의 GET /me/quests friend non-null
 *  2. 닉네임이 틀리면 422 NICKNAME_MISMATCH, 아무것도 지워지지 않음
 *  3. 맞으면 204 + 쿠키 삭제, users·lesson_sessions·friendships 행 0, B의 friend null·친구 0
 *  4. A의 옛 토큰으로 GET /me → 401
 */
import { PrismaClient } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { MeQuestsResponse } from '@cs-daily/contracts';
import { weekRangeUtc, weekStartSeoul } from '../src/modules/quests/domain/friend-quests';

const API = process.env.E2E_API_URL ?? 'http://localhost:4000';
const prisma = new PrismaClient();
const jwt = new JwtService({ secret: process.env.JWT_ACCESS_SECRET });

/** 상태 코드를 단언하지 않고 응답 그대로 돌려준다. 앞선 e2e들이 쓴 전역 리밋(분당 120)에 걸리면 Retry-After만큼 기다린다 */
const asUser = (id: string) => {
  const token = jwt.sign({ sub: id, role: 'user' }, { expiresIn: '10m' });
  const raw = async (method: string, path: string, body?: unknown) => {
    let res: Response;
    for (let attempt = 0; ; attempt++) {
      res = await fetch(`${API}${path}`, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
      if (res.status !== 429 || attempt >= 3) break;
      const wait = Number(res.headers.get('retry-after')) || 10;
      await res.text();
      await new Promise((r) => setTimeout(r, (wait + 1) * 1000));
    }
    const text = await res.text();
    return { res, status: res.status, json: text ? JSON.parse(text) : undefined };
  };
  const call = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
    const r = await raw(method, path, body);
    assert.ok(r.status >= 200 && r.status < 300, `${method} ${path} → ${r.status} ${JSON.stringify(r.json)}`);
    return r.json as T;
  };
  return { raw, call };
};

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
    const lesson = await prisma.lesson.findFirstOrThrow({ where: { sortOrder: { gt: 0 } }, select: { id: true } });
    const mk = async (suffix: string) => {
      const id = randomUUID();
      ids.push(id);
      const nick = `ead${stamp % 1e7}${suffix}`;
      await prisma.user.create({ data: { id, email: `e2e-ad-${stamp}-${suffix}@example.test`, nickname: nick } });
      return { id, nick, ...asUser(id) };
    };
    const a = await mk('a');
    const b = await mk('b');

    // 서울 이번 주 [월요일 00:00, 지금) 안에 A의 세션을 직접 넣는다
    const now = new Date();
    const { from } = weekRangeUtc(weekStartSeoul(now));
    const span = now.getTime() - from.getTime();
    assert.ok(span > 0);
    for (let i = 0; i < 3; i++) {
      const t = new Date(from.getTime() + Math.floor((span * (i + 1)) / 5));
      await prisma.lessonSession.create({ data: { userId: a.id, lessonId: lesson.id, kind: 'lesson', questionIds: [], startedAt: t, finishedAt: t } });
    }

    await a.call('POST', '/friends/requests', { userId: b.id });
    const incoming = (await b.call<{ incoming: { id: string }[] }>('GET', '/friends')).incoming;
    await b.call('POST', `/friends/requests/${incoming[0]!.id}/accept`);
    const friendOf = async () => (await b.call<MeQuestsResponse>('GET', '/me/quests')).friend;
    const view = await eventually(friendOf, '친구 퀘스트 생성');
    assert.equal(view.partner.nickname, a.nick);

    const counts = async () => ({
      users: await prisma.user.count({ where: { id: a.id } }),
      sessions: await prisma.lessonSession.count({ where: { userId: a.id } }),
      friendships: await prisma.friendship.count({ where: { OR: [{ requesterId: a.id }, { addresseeId: a.id }] } }),
      members: await prisma.friendQuestMember.count({ where: { userId: a.id } }),
    });
    const before = await counts();
    assert.deepEqual(before, { users: 1, sessions: 3, friendships: 1, members: 1 });

    // ---- 2. 닉네임 불일치
    const wrong = await a.raw('DELETE', '/me', { nickname: '틀린값' });
    assert.equal(wrong.status, 422, `불일치는 422: ${JSON.stringify(wrong.json)}`);
    assert.equal(wrong.json.error.code, 'NICKNAME_MISMATCH');
    assert.deepEqual(await counts(), before, '불일치면 아무것도 지워지지 않음');
    assert.ok(await friendOf(), '불일치면 B의 친구 퀘스트도 그대로');

    // ---- 3. 일치 → 204 + 쿠키 삭제
    const ok = await a.raw('DELETE', '/me', { nickname: a.nick });
    assert.equal(ok.status, 204, `일치하면 204: ${JSON.stringify(ok.json)}`);
    const cookies = ok.res.headers.getSetCookie().join('\n');
    for (const name of ['cs_access', 'cs_refresh']) assert.match(cookies, new RegExp(`${name}=;`), `${name} 쿠키 삭제`);
    assert.deepEqual(await counts(), { users: 0, sessions: 0, friendships: 0, members: 0 });
    assert.equal(await friendOf(), null, 'B의 friend는 null');
    assert.equal((await b.call<{ friends: unknown[] }>('GET', '/friends')).friends.length, 0, 'B의 친구 0');

    // ---- 4. 옛 토큰은 더 이상 쓸 수 없다
    const stale = await a.raw('GET', '/me');
    assert.equal(stale.status, 401, `삭제된 사용자의 옛 토큰은 401: ${JSON.stringify(stale.json)}`);

    console.log('account-deletion e2e OK');
  } finally {
    const questIds = (await prisma.friendQuestMember.findMany({ where: { userId: { in: ids } }, select: { questId: true } })).map((m) => m.questId);
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.friendQuest.deleteMany({ where: { id: { in: questIds } } });
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
