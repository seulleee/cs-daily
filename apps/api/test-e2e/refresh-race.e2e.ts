/**
 * E2E: 리프레시 회전 경쟁 (CI 전용 — 실제 Postgres + 빌드된 서버에 HTTP로 요청)
 *
 *  1. 같은 리프레시 쿠키로 동시 2회 POST /auth/refresh → 둘 다 204 + 새 쿠키
 *  2. 폐기 30초 초과 토큰 재사용 → 401 + 쿠키 삭제
 */
import { PrismaClient } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';

const API = process.env.E2E_API_URL ?? 'http://localhost:4000';
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.create({ data: { email: `e2e-refresh-${Date.now()}@example.test`, nickname: `rf${Date.now() % 1e9}` } });
  try {
    const raw = randomBytes(48).toString('base64url');
    await prisma.refreshToken.create({
      data: { userId: user.id, tokenHash: createHash('sha256').update(raw).digest('hex'), expiresAt: new Date(Date.now() + 86_400_000) },
    });
    const refresh = (token: string) => fetch(`${API}/auth/refresh`, { method: 'POST', headers: { cookie: `cs_refresh=${token}` } });

    const [a, b] = await Promise.all([refresh(raw), refresh(raw)]);
    assert.equal(a.status, 204, `동시 refresh #1 → ${a.status}`);
    assert.equal(b.status, 204, `동시 refresh #2 → ${b.status}`);
    for (const r of [a, b]) {
      const cookies = r.headers.getSetCookie().join(';');
      assert.match(cookies, /cs_access=[^;]+/);
      assert.match(cookies, /cs_refresh=[^;]+/);
    }

    // 유예(30초)를 넘겨 폐기된 토큰은 거부
    await prisma.refreshToken.updateMany({
      where: { userId: user.id, tokenHash: createHash('sha256').update(raw).digest('hex') },
      data: { revokedAt: new Date(Date.now() - 31_000) },
    });
    const stale = await refresh(raw);
    assert.equal(stale.status, 401, `유예 초과 재사용 → ${stale.status}`);

    console.log('refresh-race e2e OK');
  } finally {
    await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
