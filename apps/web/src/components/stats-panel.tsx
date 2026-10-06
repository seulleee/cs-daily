'use client';

import type { MeResponse } from '@cs-daily/contracts';
import Link from 'next/link';

/** 우측 보조 패널(PC) / 홈 상단 카드(모바일)에 공통으로 쓰는 스트릭·목표·복습 요약 */
export function StatsPanel({ me, compact = false }: { me: MeResponse; compact?: boolean }) {
  const { stats, today, user, dueReviewCount } = me;
  const goalPct = Math.min(100, Math.round((today.lessonsCompleted / user.dailyGoal) * 100));
  return (
    <div className={compact ? 'grid grid-cols-3 gap-2' : 'space-y-4'}>
      <div className="card p-4">
        <div className="text-xs font-semibold text-(--color-ink-2)">스트릭</div>
        <div className="mt-1 flex items-baseline gap-1">
          <span className="text-2xl font-black text-(--color-streak)">🔥 {stats.currentStreak}</span>
          <span className="text-sm text-(--color-ink-2)">일</span>
        </div>
        {!compact && <div className="mt-1 text-xs text-(--color-ink-2)">최장 {stats.longestStreak}일 · 프리즈 {stats.freezeCount}개</div>}
      </div>
      <div className="card p-4">
        <div className="text-xs font-semibold text-(--color-ink-2)">오늘 목표</div>
        <div className="mt-1 text-2xl font-black">
          {today.lessonsCompleted}/{user.dailyGoal}
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-(--color-line)">
          <div className="h-full rounded-full bg-(--color-brand) transition-all" style={{ width: `${goalPct}%` }} />
        </div>
      </div>
      <Link href="/review" className="card block p-4 hover:bg-(--color-surface-2)">
        <div className="text-xs font-semibold text-(--color-ink-2)">복습 예정</div>
        <div className="mt-1 text-2xl font-black">{dueReviewCount}</div>
        {!compact && <div className="mt-1 text-xs text-(--color-ink-2)">총 XP {stats.totalXp.toLocaleString()}</div>}
      </Link>
    </div>
  );
}
