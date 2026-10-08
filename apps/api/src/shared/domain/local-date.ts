/**
 * 사용자 타임존 기준 "오늘" 계산. 스트릭·데일리 목표는 서버 UTC 자정이 아니라 사용자 자정이 기준이다.
 * 반환 형식은 항상 YYYY-MM-DD.
 */
export function localDateOf(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** 사용자 타임존 기준 현재 시각 "HH:mm" */
export function localTimeOf(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(instant);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return `${get('hour') === '24' ? '00' : get('hour')}:${get('minute')}`;
}

export function addDaysToLocalDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** "YYYY-MM-DD" 로컬 자정을 해당 타임존 기준 UTC Date로 */
export function zonedMidnightToUtc(localDate: string, timeZone: string): Date {
  const guess = new Date(`${localDate}T00:00:00Z`);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(guess);
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? '0');
  const asIfUtc = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour') % 24, g('minute'), g('second'));
  const offsetMs = asIfUtc - guess.getTime();
  return new Date(guess.getTime() - offsetMs);
}
