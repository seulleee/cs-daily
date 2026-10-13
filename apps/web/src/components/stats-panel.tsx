'use client';

import type { MeResponse } from '@cs-daily/contracts';
import Link from 'next/link';
import { FlameIcon } from './icons';

/** 우측 보조 패널(PC) / 프로필 상단 타일(모바일)에 쓰는 스트릭·목표·복습 요약 */
export function StatsPanel({ me, compact = false }: { me: MeResponse; compact?: boolean }) {
  const { stats, today, user, dueReviewCount } = me;
  const goalPct = Math.min(100, Math.round((today.lessonsCompleted / user.dailyGoal) * 100));
  return (
    <div className={compact ? 'grid grid-cols-3 gap-2' : 'space-y-4'}>
      <div className="card p-4">
        <div className="text-cap font-medium text-ink-2">스트릭</div>
        <div className="mt-1 flex items-center gap-1.5 text-streak">
          <FlameIcon size={compact ? 20 : 24} />
          <span className="font-mono text-h3 font-semibold tabular-nums">{stats.currentStreak}</span>
          <span className="text-cap text-ink-2">일</span>
        </div>
        {!compact && <div className="mt-1 text-cap text-ink-2">최장 {stats.longestStreak}일 · 프리즈 {stats.freezeCount}개</div>}
      </div>
      <div className="card p-4">
        <div className="text-cap font-medium text-ink-2">오늘 목표</div>
        <div className="mt-1 font-mono text-h3 font-semibold tabular-nums">
          {today.lessonsCompleted}/{user.dailyGoal}
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-brand-fill" style={{ width: `${goalPct}%` }} />
        </div>
      </div>
      <Link href="/review" className="card block p-4">
        <div className="text-cap font-medium text-ink-2">복습 예정</div>
        <div className="mt-1 font-mono text-h3 font-semibold tabular-nums">{dueReviewCount}</div>
        {!compact && <div className="mt-1 text-cap text-ink-2">총 XP <span className="font-mono tabular-nums">{stats.totalXp.toLocaleString()}</span></div>}
      </Link>
    </div>
  );
}
