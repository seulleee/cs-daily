/** 친구 규칙 — 순수 함수. Nest·Prisma를 import하지 않는다. */
export const FRIEND_LIMIT = 100;
export const PENDING_OUT_LIMIT = 20;
export const SEARCH_MIN = 2;
export const BLOCKS_LIST_MAX = 200;
export const SEARCH_MAX = 10;

/** 두 사용자 쌍의 정규 키: 작은 id가 low. Friendship (userLowId, userHighId) 유니크에 쓴다. */
export function pairKey(a: string, b: string): { low: string; high: string } {
  return a <= b ? { low: a, high: b } : { low: b, high: a };
}

export type SendDecision = 'silent' | 'already' | 'accept-reverse' | 'create' | 'limit';

export interface SendContext {
  blockedEitherWay: boolean;
  existing: null | { status: 'pending' | 'accepted'; requesterId: string };
  me: string;
  myFriends: number;
  myPendingOut: number;
  /** 상대의 친구 수. 응답 차이로 상대 상태가 새지 않게 판정에는 쓰지 않는다. */
  theirFriends: number;
}

/**
 * 친구 요청 보내기 판정. 우선순위:
 * 내 한도(limit) → 차단(silent) → 상대가 보낸 대기(accept-reverse) → 이미 보냄/친구(already) → create.
 * 한도를 차단보다 먼저 보는 이유: 한도에 걸린 사용자가 차단한 상대에게만 202를 받으면 차단 사실이 드러난다.
 */
export function decideSend(ctx: SendContext): SendDecision {
  if (ctx.myPendingOut >= PENDING_OUT_LIMIT || ctx.myFriends >= FRIEND_LIMIT) return 'limit';
  if (ctx.blockedEitherWay) return 'silent';
  const { existing } = ctx;
  if (existing?.status === 'pending' && existing.requesterId !== ctx.me) return 'accept-reverse';
  if (existing) return 'already';
  return 'create';
}

/** SQL LIKE 패턴용 이스케이프(`\`, `%`, `_`). */
export function escapeLike(q: string): string {
  return q.replace(/[\\%_]/g, (c) => `\\${c}`);
}
