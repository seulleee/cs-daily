'use client';

import { useQueries, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { MeResponse } from '@cs-daily/contracts';
import { api } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, FlameIcon, SnowflakeIcon } from '@/components/icons';
import { StatsPanel } from '@/components/stats-panel';

type Calendar = { month: string; days: { date: string; xp: number; achieved: boolean; usedFreeze: boolean }[] };

const fetchCalendar = (month: string) => api<Calendar>(`/me/stats/calendar?month=${month}`);

export default function ProfilePage() {
  const me = useQuery({ queryKey: ['me'], queryFn: () => api<MeResponse>('/me') });
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const cal = useQuery({ queryKey: ['calendar', month], queryFn: () => fetchCalendar(month) });

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
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-fill text-title font-semibold text-on-brand">{me.data.user.nickname[0]}</div>
          )}
          <div className="min-w-0">
            <h1 className="text-h3 font-semibold">{me.data.user.nickname}</h1>
            <p className="font-mono text-cap text-ink-2">총 {me.data.stats.totalXp.toLocaleString()} XP · 최장 스트릭 {me.data.stats.longestStreak}일</p>
          </div>
        </header>
      )}
      <div className="lg:hidden">{me.data && <StatsPanel me={me.data} compact />}</div>

      {me.data && <WeekStrip today={me.data.today.date} />}

      <section className="card mt-6 p-4" aria-labelledby="cal-title">
        <div className="mb-3 flex items-center justify-between">
          <button type="button" onClick={() => shift(-1)} aria-label="이전 달" className="flex h-11 w-11 items-center justify-center rounded-full text-ink-2">
            <ChevronLeftIcon size={22} />
          </button>
          <h2 id="cal-title" className="font-mono font-semibold tabular-nums">{month}</h2>
          <button type="button" onClick={() => shift(1)} aria-label="다음 달" className="flex h-11 w-11 items-center justify-center rounded-full text-ink-2">
            <ChevronRightIcon size={22} />
          </button>
        </div>
        <CalendarGrid month={month} days={cal.data?.days ?? []} />
        <p className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-cap text-ink-2">
          <FlameIcon size={14} className="text-streak" /> 목표 달성 · <SnowflakeIcon size={14} /> 프리즈 사용 · 숫자는 그날 XP
        </p>
      </section>
    </AppShell>
  );
}

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'] as const;

/** 오늘이 속한 주(월~일). 달력 API 데이터가 모두 도착했을 때만 그린다 — 없는 날을 "못 한 날"로 꾸며 보이지 않는다 */
function WeekStrip({ today }: { today: string }) {
  const base = new Date(`${today}T00:00:00Z`);
  const monday = new Date(base.getTime() - ((base.getUTCDay() + 6) % 7) * 86_400_000);
  const dates = WEEKDAYS.map((_, i) => new Date(monday.getTime() + i * 86_400_000).toISOString().slice(0, 10));
  const months = [...new Set(dates.map((d) => d.slice(0, 7)))];
  const results = useQueries({ queries: months.map((m) => ({ queryKey: ['calendar', m], queryFn: () => fetchCalendar(m) })) });
  if (results.some((r) => !r.data)) return null;

  const byDate = new Map(results.flatMap((r) => r.data?.days ?? []).map((d) => [d.date, d]));
  return (
    <section className="card mt-6 p-4" aria-labelledby="week-title">
      <h2 id="week-title" className="text-cap font-medium text-ink-2">이번 주</h2>
      <ol className="mt-3 grid grid-cols-7 gap-1">
        {dates.map((date, i) => {
          const d = byDate.get(date);
          const isToday = date === today;
          const label = `${WEEKDAYS[i]}요일${d?.achieved ? ', 목표 달성' : d?.usedFreeze ? ', 프리즈 사용' : ''}${isToday ? ' (오늘)' : ''}`;
          return (
            <li key={date} className="flex flex-col items-center gap-1.5" aria-label={label} aria-current={isToday ? 'date' : undefined}>
              <span
                aria-hidden
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                  d?.achieved ? 'bg-(--done-bg) text-(color:--done-ink)' : 'text-ink-2'
                } ${isToday ? 'border-brand' : d?.achieved ? 'border-transparent' : 'border-line'}`}
              >
                {d?.achieved ? <CheckIcon size={16} strokeWidth={3} /> : d?.usedFreeze ? <SnowflakeIcon size={14} /> : null}
              </span>
              <span aria-hidden className={`text-cap ${isToday ? 'font-semibold text-ink' : 'text-ink-2'}`}>{WEEKDAYS[i]}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function CalendarGrid({ month, days }: { month: string; days: Calendar['days'] }) {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const first = new Date(Date.UTC(y, m - 1, 1));
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = first.getUTCDay();
  const byDate = new Map(days.map((d) => [d.date, d]));
  return (
    <div className="grid grid-cols-7 gap-1 text-center text-cap">
      {['일', '월', '화', '수', '목', '금', '토'].map((d) => <div key={d} className="py-1 font-medium text-ink-2">{d}</div>)}
      {Array.from({ length: lead }).map((_, i) => <div key={`lead-${i}`} />)}
      {Array.from({ length: count }).map((_, i) => {
        const date = `${month}-${String(i + 1).padStart(2, '0')}`;
        const d = byDate.get(date);
        return (
          <div
            key={date}
            title={d ? `${date}: ${d.xp} XP` : date}
            className={`flex aspect-square flex-col items-center justify-center rounded-lg ${d?.achieved ? 'bg-(--done-bg)' : d ? 'bg-surface-2' : ''}`}
          >
            {d?.usedFreeze ? (
              <SnowflakeIcon size={16} className="text-ink-2" />
            ) : d?.achieved ? (
              <FlameIcon size={16} className="text-streak" />
            ) : (
              <span className="font-mono font-medium tabular-nums">{i + 1}</span>
            )}
            {d && d.xp > 0 && <span className="font-mono text-[11px] tabular-nums text-ink-2">{d.xp}</span>}
          </div>
        );
      })}
    </div>
  );
}
