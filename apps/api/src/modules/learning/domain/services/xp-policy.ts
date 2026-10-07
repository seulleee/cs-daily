import { XP } from '@cs-daily/contracts';
import type { SessionKind } from './session-kind';

/**
 * XP 정책 — 기획서 8.2절.
 * - 문제당 PER_CORRECT, 오답 0
 * - 무결점 레슨 +PERFECT_LESSON_BONUS
 * - 복습 세션은 ×REVIEW_MULTIPLIER
 * - 건너뛰기 테스트(placement)는 XP 없음 (반복 응시 파밍 방지)
 * - 같은 레슨 하루 MAX_XP_REPEATS_PER_DAY회 초과 반복은 XP 없음 (repeatsToday는 호출자가 조회)
 */
export const XpPolicy = {
  perCorrectAnswer(kind: SessionKind): number {
    if (kind === 'placement') return 0;
    return kind === 'review' ? Math.round(XP.PER_CORRECT * XP.REVIEW_MULTIPLIER) : XP.PER_CORRECT;
  },

  forSession(p: { correct: number; total: number; kind: SessionKind; repeatsToday: number }): number {
    if (p.kind === 'placement' || p.repeatsToday >= XP.MAX_XP_REPEATS_PER_DAY) return 0;
    const base = p.correct * XP.PER_CORRECT;
    const bonus = p.total > 0 && p.correct === p.total ? XP.PERFECT_LESSON_BONUS : 0;
    const raw = base + bonus;
    return p.kind === 'review' ? Math.round(raw * XP.REVIEW_MULTIPLIER) : raw;
  },
};
