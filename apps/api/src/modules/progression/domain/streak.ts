import { daysBetween } from '../../../shared/domain/local-date';

/**
 * 스트릭 규칙 (기획서 8.3) — 순수 함수.
 * - 데일리 목표(레슨 수)를 채운 날이 "달성일"
 * - lastActiveDate가 어제면 +1, 오늘이면 유지, 그보다 이전이면 1로 리셋
 * - 프리즈는 배치가 "어제 미달성 + freeze 보유"일 때 적용해 lastActiveDate를 어제로 당겨 둔다
 */
export interface StreakState {
  current: number;
  longest: number;
  lastActiveDate: string | null; // YYYY-MM-DD
}

export function extendStreak(state: StreakState, today: string): { next: StreakState; extended: boolean } {
  if (state.lastActiveDate === today) return { next: state, extended: false };
  const gap = state.lastActiveDate ? daysBetween(state.lastActiveDate, today) : Infinity;
  const current = gap === 1 ? state.current + 1 : 1;
  return {
    next: { current, longest: Math.max(state.longest, current), lastActiveDate: today },
    extended: true,
  };
}

/**
 * 배치(매일 03:00 UTC 슬롯): "어제"를 놓친 사용자 처리.
 * @returns 적용할 변경. null이면 아무것도 하지 않음
 */
export function applyMissedDay(
  state: StreakState & { freezeCount: number },
  yesterday: string,
): { kind: 'freeze'; next: StreakState & { freezeCount: number } } | { kind: 'reset'; next: StreakState & { freezeCount: number } } | null {
  if (!state.lastActiveDate || state.current === 0) return null;
  if (state.lastActiveDate >= yesterday) return null; // 어제 또는 오늘 활동함
  if (daysBetween(state.lastActiveDate, yesterday) !== 1) {
    // 이틀 이상 비었으면 이미 끊긴 스트릭 — 리셋만 기록
    return { kind: 'reset', next: { ...state, current: 0 } };
  }
  if (state.freezeCount > 0) {
    return { kind: 'freeze', next: { ...state, freezeCount: state.freezeCount - 1, lastActiveDate: yesterday } };
  }
  return { kind: 'reset', next: { ...state, current: 0 } };
}
