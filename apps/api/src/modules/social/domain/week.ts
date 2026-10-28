import { addDaysToLocalDate, localDateOf, zonedMidnightToUtc } from '../../../shared/domain/local-date';

const SEOUL = 'Asia/Seoul';

/** 이번 주(Asia/Seoul 월요일 00:00)의 시작 순간 */
export function seoulWeekStart(now: Date): Date {
  const today = localDateOf(now, SEOUL);
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0=일
  return zonedMidnightToUtc(addDaysToLocalDate(today, -((dow + 6) % 7)), SEOUL);
}
