'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { MeResponse } from '@cs-daily/contracts';
import { api } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { StatsPanel } from '@/components/stats-panel';

type Calendar = { month: string; days: { date: string; xp: number; achieved: boolean; usedFreeze: boolean }[] };

export default function ProfilePage() {
  const me = useQuery({ queryKey: ['me'], queryFn: () => api<MeResponse>('/me') });
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const cal = useQuery({ queryKey: ['calendar', month], queryFn: () => api<Calendar>(`/me/stats/calendar?month=${month}`) });

  const shift = (d: number) => {
    const [y, m] = month.split('-').map(Number) as [number, number];
    const next = new Date(Date.UTC(y, m - 1 + d, 1));
    setMonth(next.toISOString().slice(0, 7));
  };

  return (
    <AppShell aside={me.data && <StatsPanel me={me.data} />}>
      {me.data && (
        <header className="mb-6 flex items-center gap-4">
          {me.data.user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={me.data.user.avatarUrl} alt="" className="h-14 w-14 rounded-full" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-(--color-brand) text-xl font-black text-white">{me.data.user.nickname[0]}</div>
          )}
          <div>
            <h1 className="text-2xl font-black">{me.data.user.nickname}</h1>
            <p className="text-sm text-(--color-ink-2)">총 {me.data.stats.totalXp.toLocaleString()} XP · 최장 스트릭 {me.data.stats.longestStreak}일</p>
          </div>
        </header>
      )}
      <div className="lg:hidden">{me.data && <StatsPanel me={me.data} compact />}</div>

      <section className="card mt-6 p-4" aria-labelledby="cal-title">
        <div className="mb-3 flex items-center justify-between">
          <button type="button" onClick={() => shift(-1)} aria-label="이전 달" className="px-2 text-lg">‹</button>
          <h2 id="cal-title" className="font-bold">{month}</h2>
          <button type="button" onClick={() => shift(1)} aria-label="다음 달" className="px-2 text-lg">›</button>
        </div>
        <CalendarGrid month={month} days={cal.data?.days ?? []} />
        <p className="mt-3 text-xs text-(--color-ink-2)">🔥 목표 달성 · ❄️ 프리즈 사용 · 숫자는 그날 XP</p>
      </section>
    </AppShell>
  );
}

function CalendarGrid({ month, days }: { month: string; days: Calendar['days'] }) {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const first = new Date(Date.UTC(y, m - 1, 1));
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = first.getUTCDay();
  const byDate = new Map(days.map((d) => [d.date, d]));
  return (
    <div className="grid grid-cols-7 gap-1 text-center text-xs">
      {['일', '월', '화', '수', '목', '금', '토'].map((d) => <div key={d} className="py-1 font-semibold text-(--color-ink-2)">{d}</div>)}
      {Array.from({ length: lead }).map((_, i) => <div key={`lead-${i}`} />)}
      {Array.from({ length: count }).map((_, i) => {
        const date = `${month}-${String(i + 1).padStart(2, '0')}`;
        const d = byDate.get(date);
        return (
          <div
            key={date}
            title={d ? `${date}: ${d.xp} XP` : date}
            className="flex aspect-square flex-col items-center justify-center rounded-lg"
            style={{ background: d?.achieved ? 'var(--color-correct-bg)' : d ? 'var(--color-surface-2)' : 'transparent' }}
          >
            <span className="font-semibold">{d?.usedFreeze ? '❄️' : d?.achieved ? '🔥' : i + 1}</span>
            {d && d.xp > 0 && <span className="text-[10px] text-(--color-ink-2)">{d.xp}</span>}
          </div>
        );
      })}
    </div>
  );
}
