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
          <span className="bit-2">{stats.currentStreak}</span>
          <span className="text-cap text-ink-2">일</span>
        </div>
        {!compact && <div className="mt-1 text-cap text-ink-2">최장 {stats.longestStreak}일 · 프리즈 {stats.freezeCount}개</div>}
      </div>
      <div className="card p-4">
        <div className="text-cap font-medium text-ink-2">오늘 목표</div>
        <div className="bit-2 mt-1">
          {today.lessonsCompleted}/{user.dailyGoal}
        </div>
        <div className="meter mt-2">
          <span style={{ width: `${goalPct}%` }} />
        </div>
      </div>
      <Link href="/review" className="card block p-4">
        <div className="text-cap font-medium text-ink-2">복습 예정</div>
        <div className="bit-2 mt-1">{dueReviewCount}</div>
        {!compact && <div className="mt-1 text-cap text-ink-2">총 XP <span className="bit">{stats.totalXp.toLocaleString()}</span></div>}
      </Link>
    </div>
  );
}
