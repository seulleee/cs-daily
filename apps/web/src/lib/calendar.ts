import { useQueries } from '@tanstack/react-query';
import { api } from './api';

/** GET /me/stats/calendar?month=YYYY-MM 응답 (contracts의 CalendarResponse는 zod 스키마뿐이라 타입을 여기서 갖는다) */
export type CalendarDay = { date: string; xp: number; achieved: boolean; usedFreeze: boolean };
export type Calendar = { month: string; days: CalendarDay[] };

export const fetchCalendar = (month: string) => api<Calendar>(`/me/stats/calendar?month=${month}`);

export const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'] as const;

/**
 * `today`(YYYY-MM-DD)가 속한 주의 월~일 날짜 7개. `today`는 서버가 사용자 시간대로 계산해 내려 주는 MeResponse.today.date를 쓴다
 * (브라우저 시계로 계산하면 사용자가 설정한 시간대와 하루 어긋날 수 있다). 날짜 산술은 UTC로만 한다.
 */
export function weekDates(today: string): string[] {
  const base = new Date(`${today}T00:00:00Z`);
  const monday = base.getTime() - ((base.getUTCDay() + 6) % 7) * 86_400_000;
  return WEEKDAYS.map((_, i) => new Date(monday + i * 86_400_000).toISOString().slice(0, 10));
}

/**
 * 이번 주 7일의 달력 데이터. 주가 두 달에 걸치면 두 달을 모두 읽는다(프로필 달력과 같은 쿼리 키 ['calendar', 월]).
 * status: loading = 아직 도착 전, error = 하나라도 실패, ready = 모두 도착(byDate 사용 가능).
 * 도착 전·실패일 때 없는 날을 "못 한 날"로 꾸며 보이지 않도록 byDate는 null이다.
 */
export function useWeekCalendar(today: string) {
  const dates = weekDates(today);
  const months = [...new Set(dates.map((d) => d.slice(0, 7)))];
  const results = useQueries({ queries: months.map((m) => ({ queryKey: ['calendar', m], queryFn: () => fetchCalendar(m) })) });
  const status = results.some((r) => r.isError) ? 'error' : results.every((r) => r.data) ? 'ready' : 'loading';
  const byDate = status === 'ready' ? new Map(results.flatMap((r) => r.data?.days ?? []).map((d): [string, CalendarDay] => [d.date, d])) : null;
  return { dates, status, byDate } as const;
}
