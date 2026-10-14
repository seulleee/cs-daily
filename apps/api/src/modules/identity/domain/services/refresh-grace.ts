/** 폐기된 리프레시 토큰을 동시 요청/다른 탭으로 보고 한 번 더 회전을 허용하는 유예(ms) */
export const REFRESH_GRACE_MS = 30_000;

export interface RefreshTokenState {
  expiresAt: Date;
  revokedAt: Date | null;
}

/**
 * 리프레시 토큰으로 새 쌍을 발급해도 되는가.
 * - 없음·만료: 거부
 * - 유효(미폐기): 허용
 * - 폐기됨: 폐기 후 30초 이내면 동시 요청(여러 쿼리·여러 탭)으로 보고 허용, 넘으면 재사용 공격 가능성으로 거부
 */
export function canRotate(row: RefreshTokenState | null | undefined, now: Date): boolean {
  if (!row) return false;
  if (row.expiresAt.getTime() <= now.getTime()) return false;
  if (!row.revokedAt) return true;
  return now.getTime() - row.revokedAt.getTime() <= REFRESH_GRACE_MS;
}
