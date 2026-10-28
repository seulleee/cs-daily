/**
 * E2E: 친구 요청·수락·차단·검색 (CI 전용 — 실제 Postgres + 빌드된 서버에 HTTP로 요청)
 *  1. 검색 → 요청 → 수락 → 양쪽 friends, 검색 relation:'friend'
 *  2. 맞요청은 바로 친구
 *  3. 차단: 관계 삭제, 양쪽 검색에서 숨김, 차단당한 쪽의 요청도 202 + 상대 incoming 0건 (정보 누출 없음)
 *  4. discoverable=false는 검색에서 빠지고 1글자 검색은 400, 남의 요청 수락은 404
 *  5. 대기 요청 20개 후 21번째는 409 FRIEND_LIMIT
 */
import { PrismaClient } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { FriendSearchResponse, FriendsResponse } from '@cs-daily/contracts';

const API = process.env.E2E_API_URL ?? 'http://localhost:4000';
const prisma = new PrismaClient();
const jwt = new JwtService({ secret: process.env.JWT_ACCESS_SECRET });

const asUser = (id: string) => {
  const token = jwt.sign({ sub: id, role: 'user' }, { expiresIn: '10m' });
  return async (method: string, path: string, body?: unknown) => {
    const res = await fetch(`${API}${path}`, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await res.text();
    return { status: res.status, json: (text ? JSON.parse(text) : undefined) as any };
  };
};
type Caller = ReturnType<typeof asUser>;

const ok = async (p: ReturnType<Caller>, status = 200) => {
  const r = await p;
  assert.equal(r.status, status, `기대 ${status}, 실제 ${r.status} ${JSON.stringify(r.json)}`);
  return r.json;
};

async function main() {
  const stamp = Date.now();
  const p = `ef${stamp % 1e8}`;
  const ids: string[] = [];
  const mk = async (suffix: string, extra: { discoverable?: boolean } = {}) => {
    const id = randomUUID();
    ids.push(id);
    await prisma.user.create({ data: { id, email: `e2e-friends-${stamp}-${suffix}@example.test`, nickname: `${p}${suffix}`, ...extra } });
    return { id, nick: `${p}${suffix}`, call: asUser(id) };
  };
  const friendsOf = async (u: { call: Caller }) => (await ok(u.call('GET', '/friends'))) as FriendsResponse;
  const searchFor = async (u: { call: Caller }, q: string) => ((await ok(u.call('GET', `/friends/search?q=${encodeURIComponent(q)}`))) as FriendSearchResponse).users;

  try {
    const [a, b, c, d] = [await mk('a'), await mk('b'), await mk('c'), await mk('d', { discoverable: false })];

    // 1. 검색 → 요청 → 수락
    const found = await searchFor(a, b.nick);
    assert.deepEqual(found.map((u) => [u.userId, u.relation]), [[b.id, 'none']], 'B가 relation none으로 검색된다');
    assert.deepEqual(Object.keys(found[0]!).sort(), ['avatarUrl', 'nickname', 'relation', 'streak', 'userId'], '검색 결과에 이메일 등이 없다');
    assert.deepEqual(await ok(a.call('POST', '/friends/requests', { userId: b.id }), 202), { status: 'sent' });
    assert.equal((await searchFor(a, b.nick))[0]!.relation, 'outgoing');
    const bList = await friendsOf(b);
    assert.equal(bList.incoming.length, 1, 'B의 incoming 1건');
    assert.equal(bList.incoming[0]!.user.userId, a.id);
    assert.equal((await searchFor(b, a.nick))[0]!.relation, 'incoming');
    assert.equal((await friendsOf(a)).outgoing.length, 1);

    // 남의 요청 수락은 404 (보낸 사람·제3자 모두)
    const reqId = bList.incoming[0]!.id;
    await ok(a.call('POST', `/friends/requests/${reqId}/accept`), 404);
    await ok(c.call('POST', `/friends/requests/${reqId}/accept`), 404);
    await ok(b.call('POST', `/friends/requests/${reqId}/accept`), 204);
    const [aList, bList2] = [await friendsOf(a), await friendsOf(b)];
    assert.deepEqual(aList.friends.map((f) => f.userId), [b.id]);
    assert.deepEqual(bList2.friends.map((f) => f.userId), [a.id]);
    assert.equal(aList.friends[0]!.weekLessons, 0);
    assert.equal(aList.outgoing.length + bList2.incoming.length, 0);
    assert.equal((await searchFor(a, b.nick))[0]!.relation, 'friend');

    // 2. 맞요청 → 바로 친구
    await ok(c.call('POST', '/friends/requests', { userId: a.id }), 202);
    assert.equal((await friendsOf(a)).incoming.length, 1);
    await ok(a.call('POST', '/friends/requests', { userId: c.id }), 202);
    const aAfter = await friendsOf(a);
    assert.deepEqual(aAfter.friends.map((f) => f.userId).sort(), [b.id, c.id].sort(), '맞요청이면 바로 친구');
    assert.equal(aAfter.incoming.length, 0);

    // 4. discoverable=false, 1글자 검색
    assert.deepEqual(await searchFor(a, d.nick), [], 'discoverable=false는 검색에 없다');
    await ok(a.call('GET', '/friends/search?q=e'), 400);
    await ok(a.call('GET', '/friends/search'), 400);

    // 3. 차단: B가 A를 차단
    await ok(b.call('POST', '/blocks', { userId: a.id }), 204);
    assert.equal((await friendsOf(a)).friends.some((f) => f.userId === b.id), false, '차단하면 친구 관계가 사라진다');
    assert.equal((await friendsOf(b)).friends.length, 0);
    assert.deepEqual(await searchFor(a, b.nick), [], 'A의 검색에 B 없음');
    assert.deepEqual(await searchFor(b, a.nick), [], 'B의 검색에 A 없음');
    await ok(a.call('POST', '/friends/requests', { userId: b.id }), 202);
    assert.equal((await friendsOf(b)).incoming.length, 0, '차단된 요청은 저장되지 않는다');
    assert.equal((await friendsOf(a)).outgoing.length, 0);
    // 차단 해제 후에는 다시 검색·요청 가능
    await ok(b.call('DELETE', `/blocks/${a.id}`), 204);
    assert.equal((await searchFor(a, b.nick))[0]!.relation, 'none');

    // 친구 끊기
    await ok(a.call('DELETE', `/friends/${c.id}`), 204);
    assert.equal((await friendsOf(c)).friends.length, 0);

    // 거절·취소
    await ok(a.call('POST', '/friends/requests', { userId: b.id }), 202);
    const toB = (await friendsOf(b)).incoming[0]!;
    await ok(b.call('POST', `/friends/requests/${toB.id}/decline`), 204);
    await ok(a.call('POST', '/friends/requests', { userId: b.id }), 202);
    const out = (await friendsOf(a)).outgoing[0]!;
    await ok(b.call('DELETE', `/friends/requests/${out.id}`), 404);
    await ok(a.call('DELETE', `/friends/requests/${out.id}`), 204);

    // 5. 대기 요청 20개 한도
    const bulk = [];
    for (let i = 0; i < 21; i++) bulk.push(await mk(`x${String(i).padStart(2, '0')}`));
    for (let i = 0; i < 20; i++) await ok(a.call('POST', '/friends/requests', { userId: bulk[i]!.id }), 202);
    const over = await a.call('POST', '/friends/requests', { userId: bulk[20]!.id });
    assert.equal(over.status, 409);
    assert.equal(over.json.error.code, 'FRIEND_LIMIT');

    console.log('friends e2e OK');
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
