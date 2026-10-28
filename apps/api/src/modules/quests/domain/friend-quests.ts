import { addDaysToLocalDate, localDateOf, zonedMidnightToUtc } from '../../../shared/domain/local-date';

export const FRIEND_QUEST_GOAL = 15;
export const FRIEND_QUEST_XP = 50;
/** 짝 대상: 최근 이 일수 안에 레슨을 완료한 사용자 */
export const ACTIVE_DAYS = 14;

const WEEK_ZONE = 'Asia/Seoul';

/** 서울 로컬 날짜 기준 그 주 월요일(YYYY-MM-DD). */
export function weekStartSeoul(now: Date): string {
  const today = localDateOf(now, WEEK_ZONE);
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0=일 … 6=토
  return addDaysToLocalDate(today, -((dow + 6) % 7));
}

/** 서울 월요일 00:00 ~ 다음 월요일 00:00 (UTC). */
export function weekRangeUtc(weekStart: string): { from: Date; to: Date } {
  return {
    from: zonedMidnightToUtc(weekStart, WEEK_ZONE),
    to: zonedMidnightToUtc(addDaysToLocalDate(weekStart, 7), WEEK_ZONE),
  };
}

/**
 * 친구끼리 한 주 짝을 짓는다. 후보 친구가 적은 사람부터 고르고, 지난주 짝은 다른 선택지가 없을 때만 다시 고른다.
 * 같은 입력이면 항상 같은 결과. 짝은 [min(id), max(id)].
 */
export function pairFriends(
  users: { id: string; friendIds: string[] }[],
  lastWeek: Map<string, string>,
): [string, string][] {
  const ids = new Set(users.map((u) => u.id));
  const friends = new Map<string, Set<string>>();
  for (const u of users) friends.set(u.id, new Set(u.friendIds.filter((f) => ids.has(f) && f !== u.id)));

  const unassigned = new Set(ids);
  const candidatesOf = (x: string): string[] =>
    [...(friends.get(x) ?? [])].filter((y) => unassigned.has(y)).sort(byId);
  const pairs: [string, string][] = [];

  for (;;) {
    let x: string | null = null;
    let xCount = Infinity;
    for (const id of [...unassigned].sort(byId)) {
      const n = candidatesOf(id).length;
      if (n > 0 && n < xCount) {
        x = id;
        xCount = n;
      }
    }
    if (x === null) break;

    const cands = candidatesOf(x);
    const fresh = cands.filter((y) => lastWeek.get(x!) !== y);
    const pool = fresh.length > 0 ? fresh : cands;
    let y = pool[0]!;
    let yCount = candidatesOf(y).length;
    for (const c of pool.slice(1)) {
      const n = candidatesOf(c).length;
      if (n < yCount) {
        y = c;
        yCount = n;
      }
    }
    pairs.push(x < y ? [x, y] : [y, x]);
    unassigned.delete(x);
    unassigned.delete(y);
  }
  return pairs;
}

function byId(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
