import { describe, expect, it } from 'vitest';
import { canRotate, REFRESH_GRACE_MS } from '../src/modules/identity/domain/services/refresh-grace';

const now = new Date('2026-10-14T12:00:00Z');
const future = new Date(now.getTime() + 86_400_000);

describe('canRotate', () => {
  it('유효한 토큰은 허용', () => {
    expect(canRotate({ expiresAt: future, revokedAt: null }, now)).toBe(true);
  });
  it('만료된 토큰은 거부', () => {
    expect(canRotate({ expiresAt: new Date(now.getTime() - 1), revokedAt: null }, now)).toBe(false);
  });
  it('폐기 30초 이내는 동시 요청으로 보고 허용 (경계 포함)', () => {
    expect(canRotate({ expiresAt: future, revokedAt: new Date(now.getTime() - 5_000) }, now)).toBe(true);
    expect(canRotate({ expiresAt: future, revokedAt: new Date(now.getTime() - REFRESH_GRACE_MS) }, now)).toBe(true);
  });
  it('폐기 30초 초과는 재사용으로 보고 거부', () => {
    expect(canRotate({ expiresAt: future, revokedAt: new Date(now.getTime() - REFRESH_GRACE_MS - 1) }, now)).toBe(false);
  });
  it('유예 안이어도 만료됐으면 거부', () => {
    expect(canRotate({ expiresAt: new Date(now.getTime() - 1), revokedAt: new Date(now.getTime() - 1_000) }, now)).toBe(false);
  });
  it('토큰이 없으면 거부', () => {
    expect(canRotate(null, now)).toBe(false);
    expect(canRotate(undefined, now)).toBe(false);
  });
});
