import { UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';

/** /internal/* 공통 인증: Authorization: Bearer {JOBS_SECRET}. 시크릿이 없으면 항상 거부 */
export function assertInternalAuth(secret: string | undefined, authorization: string | undefined, what: string): void {
  const expected = secret ? Buffer.from(`Bearer ${secret}`) : null;
  const given = Buffer.from(authorization ?? '');
  if (!expected || given.length !== expected.length || !timingSafeEqual(given, expected)) throw new UnauthorizedException(`${what}: invalid credential`);
}
